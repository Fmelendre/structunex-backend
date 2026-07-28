// .env.local (written by the Clerk CLI) takes priority; .env fills the rest.
// dotenv does not overwrite already-set vars, so load .env.local first.
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/structunex",
  calcServiceUrl: process.env.CALC_SERVICE_URL || "http://localhost:8000",
  // Orígenes permitidos para CORS. Acepta una lista separada por comas.
  // Por defecto, los dominios de producción (apex + www). localhost se permite
  // aparte en app.js para desarrollo.
  clientOrigins: (
    process.env.CLIENT_ORIGIN ||
    "https://structunex.com,https://www.structunex.com"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  clerkSecretKey: process.env.CLERK_SECRET_KEY,

  // Almacenamiento de resultados. El calc-service escribe el Parquet en este mismo
  // bucket/prefijo; aquí solo se leen (URL prefirmadas) y se borran. Ojo: las
  // credenciales de este servicio deberían poder GetObject/DeleteObject/ListBucket,
  // y las del calc-service solo PutObject.
  awsRegion: process.env.AWS_REGION || "eu-west-1",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3Bucket: process.env.AWS_S3_BUCKET || "",
  s3Prefix: (process.env.AWS_S3_PREFIX || "analysis").replace(/^\/+|\/+$/g, ""),
  // Vida de las URL prefirmadas. Corta a propósito: la descarga tarda segundos y una
  // URL que se quede pegada en el historial no debe seguir sirviendo resultados.
  s3UrlTtlS: Number(process.env.S3_URL_TTL_S || 300),
};

if (!env.clerkSecretKey) {
  console.warn(
    "[env] CLERK_SECRET_KEY is not set — auth will reject all requests. " +
      "Check .env.local (run `clerk init`)."
  );
}

if (!env.s3Bucket) {
  console.warn(
    "[env] AWS_S3_BUCKET is not set — analysis results cannot be stored or served. " +
      "Set AWS_S3_BUCKET (and AWS credentials) to run analyses."
  );
}

module.exports = { env };
