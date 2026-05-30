const express = require('express');
const healthRouter = require('./routes/health');
const exportsRouter = require('./routes/exports');

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(exportsRouter);

module.exports = app;