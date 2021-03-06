const rp = require('request-promise');
const path = require('path');
const fs = require('fs');
const _get = require('lodash/get');
const { johnsHopkinsAPI } = require('../config');
const logger = require('./create-logger');

const _ = {
  get: _get
};

const fileName = 'latest-coronavirus-stats';
const targetDirectory = path.resolve(process.cwd(), './dist');
const fileExtension = 'json';

const countriesMapUrl = path.resolve(__dirname, '../assets/countries-em-map.json');
const countriesMap = JSON.parse(fs.readFileSync(countriesMapUrl));

const result = {
  confirmed: {
    taiwan: 0,
    china: 0,
    global: 0
  },
  deaths: {
    taiwan: 0,
    china: 0,
    global: 0
  },
  recovered: {
    taiwan: 0,
    china: 0,
    global: 0
  },
  countries: []
};

const fetch = () => {
  const promises = [
    rp(johnsHopkinsAPI.countries),
    rp(johnsHopkinsAPI.totalConfirmed),
    rp(johnsHopkinsAPI.totalDeaths),
    rp(johnsHopkinsAPI.totalRecovered),
    rp(johnsHopkinsAPI.provinces)
  ];
  Promise.all(promises)
    .then((values) => {
      const countriesData = values[0];
      const provincesData = values[4];
      let exceptions = [];
      const jsonObj = JSON.parse(countriesData);
      const { features } = jsonObj;
      const resCountries = features.map((feature, index) => {
        const { Country_Region: name, Confirmed: confirmed, Recovered: recovered, Deaths: deaths } = feature.attributes;

        if (name === 'Mainland China' || name === 'China') {
          result.confirmed.china = confirmed;
          result.deaths.china = deaths;
          result.recovered.china = recovered;
        }
        if (name === 'Taiwan' || name === 'Taiwan*') {
          result.confirmed.taiwan = confirmed;
          result.deaths.taiwan = deaths;
          result.recovered.taiwan = recovered;
        }

        return {
          name: countriesMap[name.toLowerCase().trim()] || name.toLowerCase().trim(),
          ename: name.toLowerCase().trim(),
          confirmed,
          deaths,
          recovered
        };
      });

      try {
        const greenlandObj = JSON.parse(provincesData).features.find(entity => entity.attributes.Province_State === 'Greenland')
        exceptions = [
          {
            name: countriesMap.greenland,
            ename: 'greenland',
            confirmed: greenlandObj.attributes.Confirmed,
            deaths: greenlandObj.attributes.Recovered,
            recovered: greenlandObj.attributes.Deaths
          }
        ];
      } catch (e) {
        logger.log({
          level: 'error',
          message: 'fail to fetch greenland data'
        });
      }

      result.countries = [
        ...resCountries,
        ...exceptions
      ];

      result.confirmed.global = _.get(JSON.parse(values[1]), 'features[0].attributes.value', 0);
      result.deaths.global = _.get(JSON.parse(values[2]), 'features[0].attributes.value', 0);
      result.recovered.global = _.get(JSON.parse(values[3]), 'features[0].attributes.value', 0);

      fs.writeFile(`${targetDirectory}/${fileName}.${fileExtension}`, JSON.stringify(result, null, 2), (err) => {
        if (err) {
          logger.log({
            level: 'error',
            message: `fail to write file: ${fileName}: ${err}`
          });
        } else {
          logger.log({
            level: 'info',
            message: `write file ${fileName} successfully`
          });
        }
      });
    })
    .catch((e) => {
      logger.log({
        level: 'error',
        message: `fail to fetch latest info from JH's API ${e}`
      });
    });
};

function main () {
  fetch();
}

module.exports = {
  fetchLatest: main
};
