// Background analysis job.
//
// The heavy work (MYSTRAN) runs in the calc-service dyno; all this process does is hold
// the NDJSON stream open and write progress to Mongo, so running it in the web dyno is
// cheap. Everything job-related is confined to this module on purpose: swapping it for a
// BullMQ worker later means reimplementing `start`/`cancel`, not touching the routes.
//
// Results do NOT come back through here any more: the calc-service writes them straight
// to S3 as Parquet and sends back a ~1 KB manifest, which is all this module persists
// (in `analysis_runs`). That is what keeps a 10-15 MB payload off both the wire and the
// 16 MB BSON document limit.
//
// Caveat we accept: a dyno restart mid-run orphans the job. `analysisService.get` spots
// that via the progress heartbeat and reports it, so the user relaunches instead of
// staring at a spinner.

const { Project, AnalysisRun } = require("../models");
const { analyzeModelStream } = require("./calcService");
const s3Service = require("./s3Service");
const { env } = require("../config/env");
const { AppError } = require("../middleware/errorHandler");

// projectId -> AbortController for the in-flight run, so cancel() can hang up.
const running = new Map();

// Ejecuciones que se conservan por proyecto. Las más antiguas se podan (documento +
// objetos de S3) al cerrar una nueva.
const MAX_RUNS_PER_PROJECT = 10;

function isRunning(projectId) {
  return running.has(String(projectId));
}

// Structured fields we persist and relay verbatim; the frontend localizes its own text
// from them. `message` is only a legacy English fallback for unrecognized steps.
const PROGRESS_FIELDS = [
  "step",
  "message",
  "current",
  "total",
  "caseName",
  "meshAreas",
  "meshShells",
  "modeCount",
];

async function setProgress(projectId, progress) {
  const doc = { updatedAt: new Date() };
  for (const field of PROGRESS_FIELDS) doc[field] = progress[field] ?? null;
  await Project.updateOne(
    { _id: projectId },
    { $set: { analysisProgress: doc } }
  );
}

// A finished run must never leave the project stuck in "solving". If the model had
// results before, we go back to "solved" so a failed or cancelled re-run does not throw
// away what the user already had; otherwise back to "draft".
async function settleFailure(projectId, message) {
  const hadResult = await AnalysisRun.exists({ projectId, status: "solved" });
  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        status: hadResult ? "solved" : "draft",
        analysisError: message,
      },
      $unset: { analysisProgress: "" },
    }
  );
}

// Guarda el manifiesto que devuelve el calc-service en el documento de la ejecución.
// El manifiesto ya trae todo lo que hace falta para listar y comparar runs sin tocar
// S3; aquí no se interpreta nada, solo se coloca.
async function saveManifest(run, manifest) {
  const solvedAt = new Date();
  await AnalysisRun.updateOne(
    { _id: run._id },
    {
      $set: {
        status: "solved",
        solvedAt,
        durationMs: solvedAt.getTime() - run.startedAt.getTime(),
        error: null,
        s3Prefix: s3Service.runPrefix(run.projectId, run._id),
        schemaVersion: manifest.schemaVersion ?? null,
        activeDofs: manifest.activeDofs ?? [],
        notes: manifest.notes ?? [],
        cases: manifest.cases ?? [],
        counts: manifest.counts ?? {},
        modes: manifest.modes ?? [],
        mesh: manifest.mesh ?? {},
        modeShapes: manifest.modeShapes ?? null,
        springs: manifest.springs ?? null,
        bytes: manifest.bytes?.total ?? 0,
        summary: manifest.summary ?? { perCase: [], drift: [] },
        stories: manifest.stories ?? [],
      },
    }
  );
}

// Conserva las MAX_RUNS_PER_PROJECT más recientes y borra el resto, objetos de S3
// incluidos. Best-effort: si S3 falla, la regla de ciclo de vida del bucket recoge lo
// que quede huérfano.
async function pruneRuns(projectId) {
  const stale = await AnalysisRun.find({ projectId })
    .sort({ startedAt: -1 })
    .skip(MAX_RUNS_PER_PROJECT)
    .select("_id")
    .lean();
  if (stale.length === 0) return;
  await Promise.all(
    stale.map((r) =>
      s3Service.deleteRun(projectId, r._id).catch(() => {})
    )
  );
  await AnalysisRun.deleteMany({ _id: { $in: stale.map((r) => r._id) } });
}

/**
 * Launch the analysis in the background and return immediately.
 * `payload` is what the calc-service expects:
 * { analysisOptions, model, massSource, modalCases, responseSpectrum }.
 * `responseSpectrum` (functions already sampled by resolveOptions + the cases) is
 * forwarded verbatim via the spread below; absent/null => static + modal only.
 */
async function start(projectId, payload) {
  const key = String(projectId);
  if (running.has(key)) {
    throw new AppError(409, "Ya hay un análisis en curso para este proyecto");
  }

  const controller = new AbortController();
  running.set(key, controller);

  // El run se crea ANTES de lanzar el cálculo: así su _id sirve de clave en S3 y las
  // ejecuciones fallidas y canceladas también quedan registradas.
  const run = await AnalysisRun.create({ projectId, status: "solving" });

  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        status: "solving",
        // Auto-bloqueo del modelo al arrancar el análisis (estilo SAP2000). Se
        // limpia solo con un PATCH manual de desbloqueo. Se hace aquí, dentro del
        // await previo a la respuesta HTTP, para que el 202 ya llegue con el lock.
        isLocked: true,
        analysisError: null,
        analysisProgress: {
          step: "preparing",
          message: "Preparing model",
          current: null,
          total: null,
          updatedAt: new Date(),
        },
      },
    }
  );

  // Deliberately not awaited: the HTTP response goes out now.
  (async () => {
    try {
      // El destino va en la petición, no en la config del calc-service: este servicio
      // es compartido (local, staging y producción llaman al mismo), y solo NOSOTROS
      // sabemos dónde vamos a buscar luego los resultados, porque somos quienes
      // firmamos las descargas. Si cada lado tiene su propio AWS_S3_BUCKET, la
      // escritura va bien y la lectura da un 404 sin rastro en ningún log.
      const { manifest } = await analyzeModelStream(
        {
          ...payload,
          storage: {
            projectId: key,
            runId: String(run._id),
            bucket: env.s3Bucket,
            prefix: env.s3Prefix,
          },
        },
        {
          signal: controller.signal,
          onProgress: (e) => {
            // Fire-and-forget: a lost progress write must not break the run. The whole
            // event (incl. structured fields like caseName/meshShells) is persisted as-is.
            setProgress(projectId, e).catch(() => {});
          },
        }
      );

      if (!manifest) {
        throw new AppError(
          502,
          "El calc-service no devolvió el manifiesto de resultados."
        );
      }

      await setProgress(projectId, { step: "saving", message: "Saving results" });
      await saveManifest(run, manifest);
      await Project.updateOne(
        { _id: projectId },
        { $set: { status: "solved", analysisError: null }, $unset: { analysisProgress: "" } }
      );
      await pruneRuns(projectId).catch(() => {});
    } catch (err) {
      const cancelled =
        controller.signal.aborted ||
        err.name === "CanceledError" ||
        err.code === "ERR_CANCELED";
      const message = cancelled
        ? "Análisis cancelado"
        : err instanceof AppError
          ? err.message
          : "El calc-service no pudo resolver el modelo";
      await AnalysisRun.updateOne(
        { _id: run._id },
        { $set: { status: cancelled ? "cancelled" : "error", error: message } }
      ).catch(() => {});
      // Un fallo deja basura a medio escribir en S3: se limpia para que la ejecución
      // no aparente tener resultados.
      if (!cancelled) {
        await s3Service.deleteRun(projectId, run._id).catch(() => {});
      }
      await settleFailure(projectId, message).catch(() => {});
    } finally {
      running.delete(key);
    }
  })();
}

/** Hang up on the calc-service, which then kills MYSTRAN. */
function cancel(projectId) {
  const controller = running.get(String(projectId));
  if (!controller) return false;
  controller.abort();
  return true;
}

module.exports = { start, cancel, isRunning, settleFailure, MAX_RUNS_PER_PROJECT };
