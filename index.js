var request     = require('request');
var redis       = require('redis');
var Bot         = require('node-telegram-bot');
var querystring = require("querystring");

var redisKey = 'gogdeals:ids';
var base     = 'https://www.gog.com';
var regex    = /_/g;
var currentDeal;
var lastMessage;

run();
setInterval(() => run(), 2000);

client = redis.createClient();

var actions = {
  '/start': message => {
    addChatId(message.chat.id);
    publish(message.from.first_name+' has joined !');
    answer(message, 'last deal was:\n'+lastMessage);
  },
  '/end': message => {
    removeChatId(message.chat.id);
  }
}

var bot = new Bot({
  token: '150897096:AAGc7VshszdI7CtbgJEFUiY8AoRFOwEKWGQ'
})
.on('message', function (message) {
  actions[message.text] ? actions[message.text](message) : answer(message, 'only /start and /end is supported right now');
})
.start();

function run() {
  getDeal()
  .then(deal => checkDeal(deal))
  .then(deal => deal ? saveDeal(deal) : console.log('no update'))
  .then(deal => deal && alertGame(deal))
  .catch(err => console.log(err));
}

function addChatId(id) {
  client.sadd(redisKey, id);
}

function removeChatId(id) {
  client.srem(redisKey, id);
}

function getChatIds() {
  return new Promise((resolve, reject) => client.smembers(redisKey, (err, values) => err ? reject(err) : resolve(values)));
}

function answer(originalMessage, message) {
  bot.sendMessage({
    chat_id: originalMessage.chat.id,
    text: message
  });
}

function publish(message) {
  getChatIds()
  .then(accounts =>
    accounts.forEach(id => bot.sendMessage({
      chat_id: id,
      text: message
    }))
  );
}

function getDeal() {
  return new Promise((resolve, reject) => request(base+'/insomnia/current_deal', (err, response, body) => err ? reject(err) : resolve(JSON.parse(body))));
}

function saveDeal(deal) {
  currentDeal = deal;
  return deal;
}

function getName(deal) {
  deal = deal || {};
  return deal['product'] ? deal['product']['url'] : '';
}

function getTitleName(deal) {
  return deal.product.title;
}

function getImageSrc(deal) {
  return 'http:'+deal.product.image+'_product_510.jpg';
}

function getPrice(deal) {
  return deal.product.prices.groupsPrices.USD['1'].split(';').pop();
}

function getSearch(deal) {
  return 'http://www.google.com/search?'+querystring.stringify({q: getTitleName(deal)});
}

function alertGame(deal) {
  var message = `${deal.amountTotal} copies of ${getTitleName(deal)} at $${getPrice(deal)} with ${deal.discount}% off\n${base}${deal.product.url}\n${base}\n\nGoogle: ${getSearch(deal)}`;
  lastMessage = message;
  console.log(message);
  publish(message);
}

function checkDeal(deal) {
  var name        = getName(deal);
  var currentName = getName(currentDeal);
  return (name != currentName) ? Promise.resolve(deal) : Promise.resolve(null);
}
