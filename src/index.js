const app = require('./app');

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'server_started',
      port: PORT
    })
  );
});