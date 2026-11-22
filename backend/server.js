const app = require("./app");

const port = Number(process.env.API_PORT || 5000);
app.listen(port, () => {
  console.log(`SolarRoofGIS API ready at http://localhost:${port}`);
});
