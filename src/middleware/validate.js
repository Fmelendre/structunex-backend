// Runs a Zod schema against req.body. On failure -> 400 with details.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "ValidationError",
        details: result.error.flatten(),
      });
    }
    req.body = result.data; // parsed + defaults applied
    next();
  };
}

module.exports = { validate };
