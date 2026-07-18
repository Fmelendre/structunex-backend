const { makeChildController } = require("./crudFactory");
const supportService = require("../services/supportService");

module.exports = makeChildController(supportService);
