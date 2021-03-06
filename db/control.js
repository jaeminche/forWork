const vm = require("./viewmodel");
const v = require("./view");
const { UpdateChart } = require("./updateChart");

const c = {
  init_login_show: function() {
    vm.currentLogin = null;
    vm.currentShow = null;
  },

  init: function() {
    vm.chart = {
      myOptions: {
        yAxisMarkLeft: "left unit1",
        yAxisMarkRight: "right unit2"
      },
      data: {
        xAxis: ["sample label1", "sample label2"],
        yAxis1: [10, 20], //cycling
        yAxis2: [], //taximode
        yAxis3: [] //average
      }
    };
    vm.resPie = null;
  },

  setCurrentType: function(data, key) {
    if (data.superadmin === true && data.admin === true) {
      // TODO: prompt and get input by asking which one of superadmin and user the user wants
      vm[key] = "superadmin";
    } else if (data.superadmin === false && data.admin === true) {
      vm[key] = "admin";
    } else {
      vm[key] = "user";
    }
  },

  getTimeCycledInMilSec: function(resRow) {
    let total = 0;
    for (let i = 0; i < resRow.length; i++) {
      if (resRow[i].start_cycling != null) {
        let timeCycled = this.getTimeDiff(
          resRow[i].packet_generated,
          resRow[i].start_cycling
        );
        total = total + timeCycled;
      }
    }
    return total;
  },

  convToMin: function(millisec) {
    vm.stateFlag = "0575";
    var minute, seconds;
    seconds = Math.floor(millisec / 1000);
    minute = Math.floor(seconds / 60);
    seconds = seconds % 60;
    if (seconds >= 30) {
      minute += 1;
    }
    return minute;
  },

  convMilSecToFin: function(milliseconds) {
    var day, hour, minute, seconds;
    seconds = Math.floor(milliseconds / 1000);
    minute = Math.floor(seconds / 60);
    seconds = seconds % 60;
    hour = Math.floor(minute / 60);
    minute = minute % 60;
    day = Math.floor(hour / 24);
    hour = hour % 24;

    var dDisplay = day > 0 ? day + (day == 1 ? " day" : " days") : "";
    var hDisplay = hour > 0 ? hour + " hr" : "";
    var mDisplay = minute > 0 ? minute + " m" : "";

    return `${dDisplay} ${hDisplay} ${mDisplay} ${seconds} sec`;
  },

  // takes params and returns as millisec
  getTimeDiff: function(date1, date2) {
    let big = new Date(date1);
    let small = new Date(date2);
    return big - small;
  },

  getDateDayMonth: function(timestamp, period) {
    vm.stateFlag = "0541";
    if (period === "month") {
      return new Date(timestamp).getDate();
    } else if (period === "year") {
      let month = new Date(timestamp).getMonth();
      month = month + 1;
      return month;
    } else if (period === "week") {
      let day = new Date(timestamp).getDay();
      if (day === 0) {
        day = 7;
      }
      return day;
    } else if (period === "day") {
      vm.stateFlag = "0550";
      return new Date(timestamp).getHours();
    }
  },

  getFirstDayOfWeek: async function(client, period) {
    if (period === "week") {
      firstDay = await client.query(
        `select * from date_trunc('week', date(${vm.today}))`
      );
      return firstDay.rows[0].date_trunc;
    } else {
      return "";
    }
  },

  getQueryAndValueFromRedirectedCard: function(id) {
    for (let card of vm.cards[`for${vm.currentShowType}`]) {
      if (card.id === id) {
        return {
          query: card.query,
          period: card.period,
          yAxisMarkLeft: card.yAxisMarkLeft
        };
      }
    }
  },

  findCards: async function(client, req) {
    // req:  {"reqBy":"card","clickedOn":"5","period":["year"],"chart_id":[8]}
    let res = [];
    const foundCardObjs = [];
    const resRows = [];
    const resRowArrs = [];
    const reqBy = req.reqBy;
    let clickedOn = req.clickedOn;
    const period = req.period[0];
    let chartId = req.chart_id;

    vm.cards.areForChart = true;
    console.log("period: ", period);
    vm.stateFlag = "0505";
    // resets today's date one unit before or after
    let d = new Date(vm.today);
    if (reqBy === "arrow") {
      let plusOrMinusOne;
      clickedOn === "right" ? (plusOrMinusOne = 1) : (plusOrMinusOne = -1);
      if (period === "week") {
        let plusOrMinusSeven;
        clickedOn === "right"
          ? (plusOrMinusSeven = 7)
          : (plusOrMinusSeven = -7);
        d.setDate(d.getDate() + plusOrMinusSeven);
      } else if (period === "month") {
        d.setMonth(d.getMonth() + plusOrMinusOne);
      } else if (period === "year") {
        d.setFullYear(d.getFullYear() + plusOrMinusOne);
      }
      vm.today = "'" + d.toDateString() + "'";
      console.log("vm.today: ", vm.today);
    } else if (reqBy === "tab") {
    } else if (reqBy === "card") {
      chartId = [];
      chartId.push(JSON.parse(clickedOn));
    }
    console.log("chartId: ", chartId, clickedOn);

    // TODO: updates the DATE RANGE directly, instead of getting it from the xAxis labels
    // TODO: c.updateState("date_range", fromdate, todate);

    for await (let card of vm.cards[`for${vm.currentShowType}`]) {
      if (chartId.includes(card["id"]) && !!card.query) {
        switch (vm.currentShowType) {
          case "superadmin":
            vm.stateFlag = "0210";
            res = await client.query(card.query);
            break;
          case "admin":
            vm.stateFlag = "0220";
            res = await client.query(card.query, [vm.currentShow.o_id]);
            break;
          case "user":
            console.log("user card ----");
            vm.stateFlag = "0230";
            res = await client.query(card.query, [vm.currentShow.id]);
            break;
        }

        await foundCardObjs.push(card); // to get myoption data
        await resRowArrs.push(res.rows); // for stacked-bar, 2 sets pushed
      }
      // resRowSets.push(resRows);
    }
    vm.stateFlag = "0213";
    return { cardObjs: foundCardObjs, resRowArrs: resRowArrs }; // { cardObjs: [{}, {}], resRowArrs: [[], []]}
  },

  /**
   * @description finds cards and get res if areForChart === true,
   * Or updates cards' numbers if areForChart === false
   * @param {boolean} areForChart
   * @return {object} foundCardsAndRes
   */
  findCardsAndGetResOrUpdateCardsNo: async function(client, areForChart, key) {
    let res;
    const foundCardObjs = [];
    const resRows = [];
    const resRowArrs = [];

    vm.cards.areForChart = areForChart;
    if (areForChart) {
      key = "isDefaultForChart";
    } else {
      key = "isCardShown";
      this.resetState("card");
    }

    for await (let card of vm.cards[`for${vm.currentShowType}`]) {
      if (card[key] && !!card.query) {
        switch (vm.currentShowType) {
          case "superadmin":
            vm.stateFlag = "0210";
            res = await client.query(card.query);
            break;
          case "admin":
            vm.stateFlag = "0220";
            res = await client.query(card.query, [vm.currentShow.o_id]);
            break;
          case "user":
            console.log("user card ----");
            vm.stateFlag = "0230";
            res = await client.query(card.query, [vm.currentShow.id]);
            break;
        }

        if (!areForChart) {
          // ! updates directly cards' numbers when 'areForChart' is set to false
          await this.updateVM_cards(card, res);
        } else {
          await foundCardObjs.push(card); // to get myoption data
          await resRowArrs.push(res.rows); // for stacked-bar, 2 sets pushed
        }
      }
      // resRowSets.push(resRows);
    }
    vm.stateFlag = "0213";
    return { cardObjs: foundCardObjs, resRowArrs: resRowArrs }; // { cardObjs: [{}, {}], resRowArrs: [[], []]}
  },

  updateState: function(type, id, period) {
    vm.cards.areForChart = type === "chart" ? true : false;
    vm.state[type]["_id"].push(id);
    vm.state[type]["period"].push(period);
  },

  resetState: function(type) {
    vm.state[type]["_id"] = [];
    vm.state[type]["period"] = [];
  },
  /**
   * updates cards' numbers in viewmodel
   * @param {object}
   */
  updateVM_cards: async function(card, res) {
    // In order for card.number to take resCard.rowCount, card.isForTimeCalc is set to false
    console.log("carcardcard: ", card);
    if (card.resType === "timeCalculatable") {
      vm.stateFlag = "0250";
      timeCycledInMilSec = this.getTimeCycledInMilSec(res.rows);
      card.number = this.convMilSecToFin(timeCycledInMilSec);
    } else if (card.resType === "rowCountable") {
      vm.stateFlag = "0260";
      card.number = await res.rowCount;
    } else {
      card.number = "something went wrong";
    }
    this.updateState("card", card.id, card.period);
  },

  // TODO: move this to browser-side
  //  TODO: make default params of sample data
  updateVM_chart: async function(
    reqBy,
    cardObjs, // [{}, {}]
    resRowArrs, //[[], []]
    period = "month",
    // TODO: change it to await and pass 'client' as a param
    firstDayOfWeek = this.getFirstDayOfWeek("month")
  ) {
    vm.stateFlag = "0540";
    let yAxisData1 = []; // resRowArrs[0]
    let yAxisData2 = []; // resRowArrs[1]
    let yAxisData3 = []; // resRowArrs[1]
    let xAxisData = []; // ["date1", "date2"]
    let yAxisMarkLeft = "";
    let yAxisMarkRight = "";
    let chartTitle = ""; //
    const dataForChart = [];
    // let [resrows1, resrows2, resrows3] = resRowArrs;
    vm.stateFlag = "0543";
    this.resetState("chart");
    cardObjs.forEach((card, i) => {
      // ? Why the following block looping twice and getting only the last ones
      if (card.isForLeftXaxis) {
        yAxisMarkLeft = card.yAxisMark;
      } else {
        yAxisMarkRight = card.yAxisMark;
      }
      let updateChart = new UpdateChart(
        this,
        i,
        resRowArrs[i],
        card.resType,
        period,
        firstDayOfWeek
      );

      if (
        card.resType === "retrievable_date_count" ||
        card.resType === "timeCalculatable"
      ) {
        updateChart.formatResRowsInScale(this).fillResRowsInScale(this);
      } else {
      }

      if (i == 0) {
        chartTitle = card.name;
        xAxisData = updateChart.xAxisData;
        yAxisData1 = updateChart.yAxisData1;
      } else if (i == 1) {
        yAxisData2 = updateChart.yAxisData2;
      } else if (i == 2) {
        yAxisData3 = updateChart.yAxisData3;
      }
      this.updateState("chart", card.id, card.period);
      console.log("=====vm.state has been updated just now: ", vm.state);
    });

    vm.stateFlag = "0545";
    if (!yAxisMarkLeft && !!yAxisMarkRight) {
      yAxisMarkLeft = yAxisMarkRight;
      yAxisMarkRight = "";
    }
    vm.chart.myOptions.title = chartTitle;
    vm.chart.data.xAxis = xAxisData;
    vm.chart.data.yAxis1 = yAxisData1;
    vm.chart.myOptions.yAxisMarkLeft = yAxisMarkLeft;
    yAxisData2.length > 0
      ? (vm.chart.data.yAxis2 = yAxisData2)
      : (vm.chart.data.yAxis2 = []);
    yAxisData3.length > 0
      ? (vm.chart.data.yAxis3 = yAxisData3)
      : (vm.chart.data.yAxis3 = []);
    !!yAxisMarkRight
      ? (vm.chart.myOptions.yAxisMarkRight = yAxisMarkRight)
      : (vm.chart.myOptions.yAxisMarkRight = "");
  },

  fillInNoDataLabel: function(arr, period) {
    const d = new Date();
    if (period === "month") {
    }
    arr.forEach(date => {
      d(date);
    });
    return;
  },

  getXaxisDates: function(period, cYear, cMonth, index, firstDay) {
    vm.stateFlag = "0544";
    // TODO: add day
    if (period === "month") {
      return new Date(cYear, cMonth, index + 1).toDateString();
    } else if (period === "week") {
      let nextDay = new Date(firstDay);
      nextDay.setDate(nextDay.getDate() + index);
      return nextDay.toDateString();
    } else if (period === "year") {
      date = new Date(cYear, index, 1);
      return `${this.convertMonth(date.getMonth())} ${date.getFullYear()}`;
    } else if (period === "day") {
      // return new Date(cYear, cMonth, index + 1).toDateString();
    }
  },

  genDataset: function(
    xAxisData = "unable to retrieve data",
    yAxisData1 = 0,
    yAxisData2 = 0,
    yAxisData3 = 0
    // , yAxisMarkLeft = "unable to retrieve data"
  ) {
    return {
      date: xAxisData,
      xAxis: xAxisData,
      yAxis1: yAxisData1,
      yAxis2: yAxisData2,
      yAxis3: yAxisData3
      // , yAxisMarkLeft: yAxisMarkLeft
    };
  },

  genNestedPlaceholder: function(period, m, y) {
    vm.stateFlag = "0561";
    const nestedArray = [];
    let no_x_axis;
    if (period === "month") {
      no_x_axis = this.daysInMonth(m, y);
    } else if (period === "year") {
      no_x_axis = 12;
    } else if (period === "week") {
      no_x_axis = 7;
    } else if (period === "day") {
      no_x_axis = 24;
    }

    for (let i = 0; i < no_x_axis; i++) {
      nestedArray.push([]);
    }
    return nestedArray;
  },

  daysInMonth: function(month, year) {
    return new Date(year, month + 1, 0).getDate();
  },

  convertDay: function(number) {
    switch (number) {
      case 0:
        return "Sun";
        break;
      case 1:
        return "Mon";
        break;
      case 2:
        return "Tues";
        break;
      case 3:
        return "Wed";
        break;
      case 4:
        return "Thur";
        break;
      case 5:
        return "Fri";
        break;
      case 6:
        return "Sat";
        break;
    }
  },

  convertMonth: function(number) {
    switch (number) {
      case 0:
        return "Jan";
        break;
      case 1:
        return "Feb";
        break;
      case 2:
        return "Mar";
        break;
      case 3:
        return "Apr";
        break;
      case 4:
        return "May";
        break;
      case 5:
        return "Jun";
        break;
      case 6:
        return "Jul";
        break;
      case 7:
        return "Aug";
        break;
      case 8:
        return "Sep";
        break;
      case 9:
        return "Oct";
        break;
      case 10:
        return "Nov";
        break;
      case 11:
        return "Dec";
        break;
    }
  }
};

module.exports = c;
