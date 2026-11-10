// The underlying error for an API response body; hidden from visitors in production.
function errorDetail(error) {
  return process.env.NODE_ENV === "production" ? {} : { detail: error.message };
}

module.exports = { errorDetail };
