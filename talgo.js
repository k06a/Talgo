'use strict';

const LinkedList = require('linkedlist')
const log = require('single-line-log').stdout;

class TickSMA {

	constructor(period) {
    	this.period = period;
    	this.times = new LinkedList();
    	this.prices = new LinkedList();
    	this.volumes = new LinkedList();
    	this.sumOfPayments = 0;
    	this.sumOfVolumes = 0;
  	}

  	length() {
  		return this.times.length;
  	}

  	value() {
  		return this.sumOfPayments / this.sumOfVolumes;
  	}

  	push(time, price, volume) {
    	this.times.push(time);
    	this.prices.push(price);
    	this.volumes.push(volume);
    	this.sumOfPayments += price * volume;
    	this.sumOfVolumes += volume;
    	
    	while (this.times.length > 0 && this.times.head < time - this.period) {
    		this.sumOfPayments -= this.prices.head * this.volumes.head;
    		this.sumOfVolumes -= this.volumes.head;
    		this.times.shift();
    		this.prices.shift();
    		this.volumes.shift();
    	}

    	return this.value();
  	}

}

class NaiveMACD {

	constructor() {
    	this.value1_old = 0;
    	this.value2_old = 0;
  	}

  	push(value1, value2, trigger1, trigger2) {
  		if ((this.value1_old - this.value2_old) * (value1 - value2) < 0) {
  			if (value1 < value2) {
  				trigger1();
  			} else {
  				trigger2();
  			}
  		}
  		this.value1_old = value1;
  		this.value2_old = value2;
  	}

}

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

(async function(){

	async function readLines(filename, parser) {
        return new Promise(done => require('readline').createInterface({
                input: require('fs').createReadStream(filename)
            }).on('line', function (line) {
                parser(line);
            }).on('close', function () {
                done();
            })
        );
    };

    var balanceUSD = 100;
	var balanceBTC = 0;
	var ordersCount = 0;
	const balanceEQ = function(usd, btc, price){
		return usd + btc*price;
	};

	const sma1 = new TickSMA(30*60) // 1 min
	const sma2 = new TickSMA(50*60) // 2 min
	const macd = new NaiveMACD();	
	
	const buy = function(price, time) {
		const amountUSD = balanceEQ(balanceUSD, balanceBTC, price) / 3;
		if (balanceUSD > amountUSD) {
			balanceUSD -= amountUSD;
			balanceBTC += amountUSD / price;
		}
		// console.log((new Date(time * 1000)).toISOString().substring(0, 10) + ': ' +
		// 			'[BUY] ' + Math.trunc(amountUSD / price * 1000)/1000 +
		// 			' BTC for $' + Math.trunc(amountUSD*100)/100 +
		// 			' by price $' + Math.trunc(price*100)/100 +
		// 			' ($' + Math.trunc(balanceEQ(balanceUSD, balanceBTC, price)*100)/100 + 
		// 			', BTC ' + Math.trunc(balanceEQ(balanceUSD, balanceBTC, price)/price*1000)/1000 + ')');
	}

	const sell = function(price, time) {
		const amountBTC = (balanceEQ(balanceUSD, balanceBTC, price) / price) / 3;
		if (balanceBTC > amountBTC) {
			balanceBTC -= amountBTC;
			balanceUSD += amountBTC * price;
		}
		// console.log((new Date(time * 1000)).toISOString().substring(0, 10) + ': ' +
		// 			'[SELL] ' + Math.trunc(amountBTC * 1000)/1000 +
		// 			' BTC for $' + Math.trunc(amountBTC * price * 100)/100 +
		// 			' by price $' + Math.trunc(price*100)/100 +
		// 			' ($' + Math.trunc(balanceEQ(balanceUSD, balanceBTC, price) * 100)/100 +
		// 			', BTC ' + Math.trunc(balanceEQ(balanceUSD, balanceBTC, price)/price*1000)/1000 + ')');
	}

	console.log('time,balanceUSD,balanceBTC,balanceEQ,price');
	const logState = function(price, time) {
		console.log((new Date(time * 1000)).toISOString().substring(0, 19).replace('T', ' ') + ',' +
					Math.trunc(balanceUSD * 100)/100 + ',' +
					Math.trunc(balanceBTC*100000000)/100000000 + ',' +
					Math.trunc(balanceEQ(balanceUSD, balanceBTC, price) * 100)/100 + ',' +
					price);
	}

	var i = 0;
	var lastPrice = 0;
    await readLines('cexUSD.csv', async line => {
    	var [time, price, volume] = line.split(',');
    	time = Number(time);
    	price = Number(price);
    	volume = Number(volume);
    	//console.log(time + '\t' + price + '\t' + volume);

    	sma1.push(time, price, volume);
    	sma2.push(time, price, volume);
    	//console.log(sma1.length() + '\t' + sma2.length());

    	macd.push(sma1.value(), sma2.value(), async function() {
    		buy(price, time);
    		ordersCount++;
    		logState(price, time);
    	}, async function() {
    		sell(price, time);
    		ordersCount++;
    		logState(price, time);
    	});

    	lastPrice = price;
    	i++;
    	//log('\rCompleted ' + Math.trunc(i * 100 / 5000000) + '%');
    });

    //console.log('ORDERS: ' + ordersCount);
    //console.log('BALANCE: $' + Math.trunc(balanceEQ(balanceUSD, balanceBTC, lastPrice) * 100)/100 +
	//		    ' + ' + Math.trunc(balanceEQ(balanceUSD, balanceBTC, lastPrice) / lastPrice * 1000)/1000 + ' BTC');

})()