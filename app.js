// Need to do more stuff

const express = require('express')
const ejs = require('ejs')

const app = express()

app.set('view engine', 'ejs')

app.get('/', function(req, res){
    res.render('main');
});

app.listen(3000, function(){
    console.log('server started');
});