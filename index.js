const puppeteer = require("puppeteer");
const chalk = require("chalk");
const fs = require("fs");

const error = chalk.bold.red;
const success = chalk.keyword("green");
const info = chalk.keyword("orange");
const MAXPageSize = 1;
const BASE_AUTO_TRADER_URL = "https://www.autotrader.co.uk";
const START_PAGE = 1;
const GetAllCarDetailLinks = async () => {
  var browser = await puppeteer.launch({ headless: true });
  var page = await browser.newPage();
  var allLinks = [];
  for (var pageCount = START_PAGE; pageCount <= MAXPageSize; pageCount++) {
    logInfo(`opening page ${pageCount}`);
    await page.goto(
      `${BASE_AUTO_TRADER_URL}/car-search?sort=distance&postcode=eh525en&radius=25&year-from=2018&fuel-type=Electric&page=${pageCount}`
    );

    try {
      await page.waitForSelector(".search-page__results");

      var carDetailLinks = await page.evaluate(() => {
        var links = [];
        var linksSelector = document.querySelectorAll("a.listing-fpa-link ");

        for (var i = 0; i < linksSelector.length; i++) {
          var link = linksSelector[i];
          links.push(link.getAttribute("href"));
        }
        return links;
      });

      for (var i = 0; i < carDetailLinks.length; i++) {
        allLinks.push(`${BASE_AUTO_TRADER_URL}${carDetailLinks[i]}`);
      }
    } catch {
      logError(`Unable to Load page ${pageCount}`);
    }
  }
  browser.close();
  logInfo("closing browser");
  return allLinks;
};

const getCarDetails = async (browser, url) => {
  var page = await browser.newPage();
  logInfo(`Get details for ${url}`);
  try {
    await page.goto(url);
    await page.waitForSelector(".advert-heading__title");

    var carDetails = await page.evaluate(() => {
      const parseBatterPerformanceDetails = (elements) => {
        var batteryPerformance = {};

        for (var i = 0; i < elements.length; i++) {
          var rootElement = elements[i];
          var titleElement = rootElement.querySelector(
            "h5.battery-performance-specification__title"
          );
          var titleText = titleElement.textContent;
          var value = rootElement.querySelector(
            "p.battery-performance-specification__spec-text"
          ).textContent;

          switch (titleText) {
            case "Battery range":
              batteryPerformance.batteryRange = value;
              break;
            case "Full charge":
              batteryPerformance.fullChargeTime = value;
              break;
            case "Quick charge":
              batteryPerformance.quickChargeTime = value;
              break;
          }
        }
        return batteryPerformance;
      };

      const parseKeySpecs = (elements) => {
        var keySpecs = {};

        keySpecs.transmissionType = elements[0].textContent;
        keySpecs.vehicleType = elements[1].textContent;
        keySpecs.fuelType = elements[2].textContent;
        keySpecs.doors = parseInt(elements[3].textContent.split(" ")[0]);
        keySpecs.seats = parseInt(elements[4].textContent.split(" ")[0]);
        return keySpecs;
      };

      var carDetails = {};
      var headingElement = document.querySelector("h1.advert-heading__title");
      carDetails.name = headingElement.textContent;

      carDetails.year = parseInt(document.querySelector("p.advert-heading__year-title").textContent.split(" "));

      var subHeadingElement = document.querySelector(
        "p.advert-heading__sub-title"
      );
      carDetails.subHeading = subHeadingElement.textContent;

      var priceElement = document.querySelector("h2.price-confidence__price ");
      carDetails.price = parseInt(
        priceElement.textContent.replace(",", "").replace("£", "").split(" ")[1]
      );

      var pictureElement = document.querySelector(
        "div.fpa-gallery__placeholder"
      );
      var highRestPictureElement = pictureElement.childNodes[0];
      carDetails.pictureUrl = highRestPictureElement.getAttribute("src");

      var keySpecsDivElement = document.querySelector("div.fpa__key-specs");
      var keySpecsElements = keySpecsDivElement.querySelectorAll(
        "span.price-confidence-key-specifications__text"
      );
      carDetails.keySpecs = parseKeySpecs(keySpecsElements);

      var batterPerformanceDivElement = document.querySelector(
        "div.battery-performance"
      );
      var batterPerformanceSpecificationElements = batterPerformanceDivElement.querySelectorAll(
        "div.battery-performance-specification"
      );

      carDetails.batteryPerformance = parseBatterPerformanceDetails(
        batterPerformanceSpecificationElements
      );

      return carDetails;
    });
    await page.close();
    return carDetails;
  } catch {
    logError(`failed to go to ${url}`);
  }
};

(async () => {
  var carDetailLinks = (await GetAllCarDetailLinks()).filter(
    (el, i, a) => i === a.indexOf(el)
  );
  var browser = await puppeteer.launch({ headless: true });
  var allDetails = [];
  for (var i = 0; i < carDetailLinks.length; i++) {
    logInfo(`Processing ${i + 1}/${carDetailLinks.length}`);
    var details = await getCarDetails(browser, carDetailLinks[i]);
    if (details) {
      details.siteUrl = carDetailLinks[i];
      allDetails.push(details);
    }
  }
  browser.close();
  fs.writeFileSync("output.json", JSON.stringify(allDetails));
})();

const logSuccess = (message) => console.log(success(message));
const logError = (message) => console.log(error(message));
const logInfo = (message) => console.log(info(message));
