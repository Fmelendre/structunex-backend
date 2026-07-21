// Background analysis job.
//
// The heavy work (MYSTRAN) runs in the calc-service dyno; all this process does is hold
// the NDJSON stream open and write progress to Mongo, so running it in the web dyno is
// cheap. Everything job-related is confined to this module on purpose: swapping it for a
// BullMQ worker later means reimplementing `start`/`cancel`, not touching the routes.
//
// Caveat we accept: a dyno restart mid-run orphans the job. `analysisService.get` spots
// that via the progress heartbeat and reports it, so the user relaunches instead of
// staring at a spinner.

const { Project, Result } = require("../models");
const { analyzeModelStream } = require("./calcService");
const { AppError } = require("../middleware/errorHandler");

// projectId -> AbortController for the in-flight run, so cancel() can hang up.
const running = new Map();

function isRunning(projectId) {
  return running.has(String(projectId));
}

async function setProgress(projectId, step, message, current, total) {
  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        analysisProgress: {
          step,
          message,
          current: current ?? null,
          total: total ?? null,
          updatedAt: new Date(),
        },
      },
    }
  );
}

// A finished run must never leave the project stuck in "solving". If the model had
// results before, we go back to "solved" so a failed or cancelled re-run does not throw
// away what the user already had; otherwise back to "draft".
async function settleFailure(projectId, message) {
  const hadResult = await Result.exists({ projectId });
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

/**
 * Launch the analysis in the background and return immediately.
 * `payload` is what the calc-service expects: { analysisOptions, model, massSource, modalCases }.
 */
async function start(projectId, payload) {
  const key = String(projectId);
  if (running.has(key)) {
    throw new AppError(409, "Ya hay un análisis en curso para este proyecto");
  }

  const controller = new AbortController();
  running.set(key, controller);

  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        status: "solving",
        analysisError: null,
        analysisProgress: {
          step: "preparing",
          message: "Preparando modelo",
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
      const result = await analyzeModelStream(payload, {
        signal: controller.signal,
        onProgress: (e) => {
          // Fire-and-forget: a lost progress write must not break the run.
          setProgress(projectId, e.step, e.message, e.current, e.total).catch(() => {});
        },
      });

      await setProgress(projectId, "saving", "Guardando resultados");
      await Result.findOneAndUpdate(
        { projectId },
        { $set: { ...result, projectId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await Project.updateOne(
        { _id: projectId },
        { $set: { status: "solved", analysisError: null }, $unset: { analysisProgress: "" } }
      );
    } catch (err) {
      const cancelled =
        controller.signal.aborted ||
        err.name === "CanceledError" ||
        err.code === "ERR_CANCELED";
      await settleFailure(
        projectId,
        cancelled
          ? "Análisis cancelado"
          : err instanceof AppError
            ? err.message
            : "El calc-service no pudo resolver el modelo"
      ).catch(() => {});
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

module.exports = { start, cancel, isRunning, settleFailure };
