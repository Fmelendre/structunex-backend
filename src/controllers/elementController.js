const { makeChildController } = require("./crudFactory");
const elementService = require("../services/elementService");

module.exports = makeChildController(elementService);
