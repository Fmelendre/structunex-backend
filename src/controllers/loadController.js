const { makeChildController } = require("./crudFactory");
const loadService = require("../services/loadService");

module.exports = makeChildController(loadService);
