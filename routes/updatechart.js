const express = require("express");
const router = express.Router({ mergeParams: true });
const bodyParser = require("body-parser");
const { Pool, Client } = require("pg");
const client_config = require("../config/client");
const basic_config = require("../config/basic_config");
const Chart = require("chart.js");
const vm = require("../db/viewmodel");
const c = require("../db/control");
const { UpdateChart } = require("./updateChart");
const v = require("../db/view");
const db = require("../db/index");

const pool = new Pool(client_config);
// const client = new Client(client_config);

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

router.post("/updatechart", async function(req, res) {
  const client = await pool.connect();
  vm.stateFlag = "0500";

  try {
    let resChart, reqBy, chart_id, foundCards;
    let areForChart = true;
    c.init();

    vm.stateFlag = "0501";
    console.log("updatechart post route is called");
    console.log("req.body: ", req.body);
    // req.body:  {"reqBy":"card","clickedOn":"5","period":["year"],"chart_id":[8]}

    foundCards = await c.findCards(client, req.body);
    console.log("foundCards: ", foundCards);
    vm.stateFlag = "0504";
    let period = foundCards.cardObjs[0].period;
    let firstDay = await c.getFirstDayOfWeek(client, period);

    vm.stateFlag = "0508";
    await c.updateVM_chart(
      req.body.reqBy,
      foundCards.cardObjs,
      foundCards.resRowArrs,
      period,
      firstDay
    );
    // TAB FEATURE TO BE DELETED CONFIRMED BY ROEL.
    if (req.body.reqBy === "tab") {
      //   period = req.body.period;
      //   reqBy = "period";
      //   console.log("TCL: period", period);
      //   console.log("vm.currentShowType:", vm.currentShowType);
      //   for await (let card of vm.cards[`for${vm.currentShowType}`]) {
      //     if (card.period === period) {
      //       if (card.isForLeftXaxis) {
      //         resChart = await client.query(card.query, [vm.currentShow.id]);
      //         resChart = resChart.rows;
      //       } else {
      //       }
      //       // break;
      //     }
      //   }
      //   let firstDayOfWeek = await c.getFirstDayOfWeek(period);
    } else if (req.body.reqBy === "card") {
      //   chart_id = req.body.chart_id;
    } else if (req.body.reqBy === "arrow") {
      //   console.log("clicked on arrow");
      //   console.log(req.body);
      //   let foundCardsAndRes = await c.findCardsAndGetRes(
      //     client,
      //     "name",
      //     req.body.cardtitle,
      //     req.body.towards
      //   );
    }

    vm.stateFlag = "0510";
    let resMyJson = await {
      xAxis: vm.chart.data.xAxis,
      yAxis1: vm.chart.data.yAxis1,
      yAxis2: vm.chart.data.yAxis2,
      yAxis3: vm.chart.data.yAxis3,
      title: vm.chart.myOptions.title,
      yAxisMarkLeft: vm.chart.myOptions.yAxisMarkLeft,
      yAxisMarkRight: vm.chart.myOptions.yAxisMarkRight
    };

    await res.send(resMyJson);
  } catch (ex) {
    // await client.query('ROLLBACK')
    console.log(`something went wrong ${ex} at ${vm.stateFlag}`);
    // vm.currentShow = null;
    // // TODO: modify redirect destination
    // setTimeout(function redirect() {
    //   res.redirect(`/dashboard/${req.params.uuid}`);
    // }, 5000);
  } finally {
    await client.release();
    console.log("Client disconnected");
  }
});

router.post("/update", async function(req, res) {
  console.log("card clicked=====================");
  const client = await pool.connect();
  vm.stateFlag = "0700";
  try {
    // res.send(dataForChartArea);
  } catch (ex) {
    // await client.query('ROLLBACK')
    console.log(`something went wrong ${ex} at ${vm.stateFlag}`);
    vm.currentShow = null;
    // TODO: modify redirect destination
    setTimeout(function redirect() {
      res.redirect(`/dashboard/${req.params.uuid}`);
    }, 5000);
  } finally {
    await client.release();
    console.log("Client disconnected");
  }
});

router.post("/updateChartWithCards", async function(req, res) {
  console.log("card clicked=====================");
  const client = await pool.connect();
  vm.stateFlag = "0700";
  try {
    let resChart, showStatePosted;
    cardIdClickedOn = req.body.chart_id;
    let reqType = "card";
    console.log("TCL: cardIdClickedOn", cardIdClickedOn);
    console.log("vm.currentShowType:", vm.currentShowType);

    vm.stateFlag = "0701";
    for await (let card of vm.cards[`for${vm.currentShowType}`]) {
      console.log("in for of loop and before if");
      console.log("card.id: ", typeof card.id);
      console.log("cardIdClickedOn: ", typeof cardIdClickedOn);
      // if (cardIdClickedOn.equals(card.id)) {
      //   console.log("finally in...");
      if (card.id == cardIdClickedOn) {
        console.log("finally in...");
        // showStatePosted = card.auth[card.auth.length - 1];
        // if (card.isForLeftXaxis) {
        if (card["idRedirectedForChartQuery"] != null) {
          console.log(
            "in idRedirectedForChartQuery!!",
            card.idRedirectedForChartQuery
          );
          if (vm.currentShowType === "superadmin") {
            resChart = await client.query(
              c.getQueryAndValueFromRedirectedCard(
                card.idRedirectedForChartQuery
              )["query"]
            );
          } else if (vm.currentShowType === "admin") {
            resChart = await client.query(
              c.getQueryAndValueFromRedirectedCard(
                card.idRedirectedForChartQuery
              )["query"],
              [vm.currentShow.o_id]
            );
          } else if (vm.currentShowType === "user") {
            resChart = await client.query(
              c.getQueryAndValueFromRedirectedCard(
                card.idRedirectedForChartQuery
              )["query"],
              [vm.currentShow.id]
            );
          }
        } else {
          resChart = await client.query(card.query);
        }
      }
    }

    vm.stateFlag = "0710";
    resChart = resChart.rows;
    console.log("TCL: forawait -> ###resChart", resChart);

    c.updateVM_chart(reqType, resChart, null, null);
    vm.stateFlag = "0600";

    let labels = [],
      data = [];
    // TODO: change vm.area
    vm.area.datasets.forEach(dataset => {
      labels.push(dataset.label);
      data.push(dataset.data);
    });
    // TODO: manipulate labels into such as "Mon"
    let result = {
      date: labels,
      labels: labels,
      data: data,
      yAxisUnit: "min."
    };

    // TODO: use c.createBarChart instead of the following line
    // let dataForChartArea = {
    //   data: labels,
    //   labels: labels,
    //   data: data,
    //   yAxisUnit: "cust."
    // };
    // console.log(dataForChartArea);
    res.send(result);
  } catch (ex) {
    // await client.query('ROLLBACK')
    console.log(`something went wrong ${ex} at ${vm.stateFlag}`);
    vm.currentShow = null;
    // TODO: modify redirect destination
    setTimeout(function redirect() {
      res.redirect(`/dashboard/${req.params.uuid}`);
    }, 5000);
  } finally {
    await client.release();
    console.log("Client disconnected");
  }
});

module.exports = router;
