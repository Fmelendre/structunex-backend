// Job de comprobación por normativa, en segundo plano.
//
// Espejo de `analysisJob`, con dos diferencias que importan:
//
//   1. NO toca `project.status` ni bloquea el modelo. Comprobar no re-resuelve nada, así
//      que dejar el proyecto en "solving" mientras se comprueba impediría editar por una
//      razón que no existe.
//   2. Es una llamada sencilla, no un stream. Comprobar tarda segundos, no minutos: el
//      progreso que se persiste es el de las fases del propio job, y no hay ningún
//      proceso externo largo al que haya que mantener vivo con latidos.

const { Project, DesignRun } = require("../models");
const { designModel } = require("./calcService");
const s3Service = require("./s3Service");
const { env } = require("../config/env");
const { AppError } = require("../middleware/errorHandler");

// projectId -> AbortController de la comprobación en vuelo.
const running = new Map();

// Comprobaciones que se conservan por proyecto; las más viejas se podan al cerrar una
// nueva. Menos que en análisis: pesan poco pero se relanzan muchísimo más.
const MAX_RUNS_PER_PROJECT = 5;

function isRunning(projectId) {
  return running.has(String(projectId));
}

async function setProgress(projectId, progress) {
  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        designProgress: {
          step: progress.step ?? null,
          current: progress.current ?? null,
          total: progress.total ?? null,
          updatedAt: new Date(),
        },
      },
    }
  );
}

/** Cierra una comprobación fallida sin tocar lo que ya hubiera comprobado antes. */
async function settleFailure(projectId, runId, message) {
  if (runId) {
    await DesignRun.updateOne(
      { _id: runId },
      { $set: { status: "error", error: message, finishedAt: new Date() } }
    ).catch(() => {});
  }
  await Project.updateOne(
    { _id: projectId },
    { $set: { designError: message }, $unset: { designProgress: "" } }
  );
}

async function saveManifest(run, manifest) {
  const finishedAt = new Date();
  await DesignRun.updateOne(
    { _id: run._id },
    {
      $set: {
        status: "done",
        finishedAt,
        durationMs: finishedAt.getTime() - run.startedAt.getTime(),
        error: null,
        s3Prefix: s3Service.runPrefix(run.projectId, run._id),
        schemaVersion: manifest.schemaVersion ?? null,
        code: manifest.code ?? null,
        steelCode: manifest.steelCode ?? null,
        combos: manifest.combos ?? [],
        files: manifest.files ?? {},
        counts: manifest.counts ?? {},
        notes: manifest.notes ?? [],
        bytes: manifest.bytes?.total ?? 0,
        summary: manifest.summary ?? {},
      },
    }
  );
}

async function pruneRuns(projectId) {
  const stale = await DesignRun.find({ projectId })
    .sort({ startedAt: -1 })
    .skip(MAX_RUNS_PER_PROJECT)
    .select("_id")
    .lean();
  if (stale.length === 0) return;
  await Promise.all(
    stale.map((r) => s3Service.deleteRun(projectId, r._id).catch(() => {}))
  );
  await DesignRun.deleteMany({ _id: { $in: stale.map((r) => r._id) } });
}

/**
 * Lanza la comprobación en segundo plano y vuelve enseguida.
 * `payload` es { analysisRunId, cases, model, combinations, preferences }.
 */
async function start(projectId, payload) {
  const key = String(projectId);
  if (running.has(key)) {
    throw new AppError(409, "Ya hay una comprobación en curso para este proyecto");
  }

  const controller = new AbortController();
  running.set(key, controller);

  const run = await DesignRun.create({
    projectId,
    analysisRunId: payload.analysisRunId,
    status: "designing",
    code: payload.preferences?.code ?? null,
    steelCode: payload.preferences?.steelCode ?? null,
  });

  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        designError: null,
        designProgress: { step: "preparing", updatedAt: new Date() },
      },
    }
  );

  // A propósito sin await: la respuesta HTTP sale ya.
  (async () => {
    try {
      await setProgress(projectId, { step: "checking" });
      // El origen y el destino van los dos en la petición. El calc-service es
      // compartido (local, staging y producción llaman al mismo), y solo nosotros
      // sabemos de qué bucket leer y en cuál escribir, porque somos quienes firmamos
      // las descargas después.
      const { manifest } = await designModel(
        {
          source: {
            projectId: key,
            runId: String(payload.analysisRunId),
            bucket: env.s3Bucket,
            prefix: env.s3Prefix,
            cases: payload.cases,
          },
          ...payload.model,
          combinations: payload.combinations,
          preferences: payload.preferences,
          storage: {
            projectId: key,
            runId: String(run._id),
            bucket: env.s3Bucket,
            prefix: env.s3Prefix,
          },
        },
        { signal: controller.signal }
      );

      if (!manifest) {
        throw new AppError(
          502,
          "El calc-service no devolvió el manifiesto de la comprobación."
        );
      }

      await setProgress(projectId, { step: "saving" });
      await saveManifest(run, manifest);
      await Project.updateOne(
        { _id: projectId },
        { $set: { designError: null }, $unset: { designProgress: "" } }
      );
      await pruneRuns(projectId).catch(() => {});
    } catch (err) {
      const cancelled =
        controller.signal.aborted ||
        err.name === "CanceledError" ||
        err.code === "ERR_CANCELED";
      const message = cancelled
        ? "Comprobación cancelada"
        : err instanceof AppError
          ? err.message
          : "El calc-service no pudo comprobar el modelo";
      await DesignRun.updateOne(
        { _id: run._id },
        {
          $set: {
            status: cancelled ? "cancelled" : "error",
            error: message,
            finishedAt: new Date(),
          },
        }
      ).catch(() => {});
      if (!cancelled) {
        await s3Service.deleteRun(projectId, run._id).catch(() => {});
      }
      await Project.updateOne(
        { _id: projectId },
        { $set: { designError: message }, $unset: { designProgress: "" } }
      ).catch(() => {});
    } finally {
      running.delete(key);
    }
  })();
}

function cancel(projectId) {
  const controller = running.get(String(projectId));
  if (!controller) return false;
  controller.abort();
  return true;
}

module.exports = { start, cancel, isRunning, settleFailure, MAX_RUNS_PER_PROJECT };
