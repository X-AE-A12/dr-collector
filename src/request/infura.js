const axios = require('axios');
const rateLimit = require('axios-rate-limit');

// sets max 2 requests per 1 second, other will be delayed
// note maxRPS is a shorthand for perMilliseconds: 1000, and it takes precedence
// if specified both with maxRequests and perMilliseconds
module.exports = rateLimit(axios.create(), {
    maxRequests: 2,
    perMilliseconds: 1000,
    maxRPS: 2
})
