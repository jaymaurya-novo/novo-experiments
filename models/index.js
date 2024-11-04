'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const _ = require('lodash');
const {  logger } = require('../configs/logger.js');
const config = require('../configs/config.json');

const rootPath = path.normalize(`${__dirname}/..`);
const MODELS_DIR = `${rootPath}/models`;

const db = {};

const { Op } = Sequelize;
const operatorsAliases = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $not: Op.not,
  $in: Op.in,
  $notIn: Op.notIn,
  $is: Op.is,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $notILike: Op.notILike,
  $regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $overlap: Op.overlap,
  $contains: Op.contains,
  $contained: Op.contained,
  $adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  $strictRight: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  $and: Op.and,
  $or: Op.or,
  $any: Op.any,
  $all: Op.all,
  $values: Op.values,
  $col: Op.col,
};

const sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, {
  ...config.db,
  operatorsAliases,
  benchmark: true,
  logging: (sql, executionTime) => {
    // Only log long running queries
    if (executionTime > 10000) logger.debug('QUERY', 'API-QUERY', { sql, execution_time: executionTime });
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

console.log('Loading models from:', MODELS_DIR);


// loop through all files in models directory ignoring hidden files and this file
fs.readdirSync(MODELS_DIR)
  .filter((file) => (file.indexOf('.') > 0) && file !== 'index.js')
  // import model files and save model names
  .forEach((file) => {
      console.log('Loading model:', file);
    // eslint-disable-next-line global-require
    const model = require(path.join(MODELS_DIR, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// invoke associations on each of the models
Object.keys(db).forEach((modelName) => {
  if (db[modelName].prototype.setAssociations) {
    db[modelName].prototype.setAssociations(db);
  }
});

      console.log('Loading models Done');

sequelize.Op = Sequelize.Op;

module.exports = _.extend({
  sequelize,
  Sequelize,
}, db);
