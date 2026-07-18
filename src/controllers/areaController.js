const { makeChildController } = require("./crudFactory");
const areaService = require("../services/areaService");

module.exports = makeChildController(areaService);
