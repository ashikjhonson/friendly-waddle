const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: true}));

// mysql connection
const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'fw'
});

conn.connect((err)=>{
    if(err){
        console.log('Error', err);
    }
    else{
        console.log("Connected");
    }
});


// variables
const trending = [];
const usersArray = [];
const questionsArray = [];

// Trending section
let sql = 'SELECT * FROM TRENDING';
conn.query(sql, function(err, result){            
    trending.push(...result);    
}); 

// Fetching Users
function fetchUsers(){
    sql = 'SELECT Name FROM USERS';
    conn.query(sql, function(err, result){
        usersArray.push(...result);         
    });
}
fetchUsers();

// Fetching Questions
function fetchQuestions(){
    sql = 'SELECT Question FROM QUESTIONS';
    conn.query(sql, function(err, result){
        questionsArray.push(...(result));
    });
}
fetchQuestions();


app.get('/', (req, res)=>{                 
    res.render('index', {trending: trending, usersArray: usersArray});
});

app.get('/login', (req, res)=>{
    res.render('login');
});

app.get('/register', (req, res)=>{
    res.render('register');
});

app.get('/give-answers', (req, res)=>{    
    res.render('questions', {questionsArray: questionsArray});
});

app.get('*', (req, res) => {
    res.status(404).render('404');
  });

  app.listen(port);
  console.log('The magic happens on port ' + port);