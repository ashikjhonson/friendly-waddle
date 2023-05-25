require('dotenv').config();
const express = require('express');
const session = require('express-session')
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const MemoryStore = require('memorystore')(session);

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
        checkPeriod: 86400000 
    })
}))

// mysql connection
const conn = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

conn.connect((err)=>{
    if(err) console.log(err);
    else console.log('Connected to database...');    
})


// variables
const usersArray = [];

// verify user
const isAuthenticated = async (req, res, next)=>{
    if(req.session.loggedIn){        
        next();
    }        
    else    
        res.redirect('/login')
}

// unauthorized user?
const isNotAuthenticated = async (req, res, next)=>{
    if(!req.session.loggedIn)
        next();
    else    
        res.redirect('/');
}

// Fetching Users
function fetchUsers(){
    sql = 'SELECT Name FROM users';
    conn.query(sql, function(err, result){
        usersArray.push(...result);         
    });
}
fetchUsers();


// Routes
app.get('/', isAuthenticated,(req, res)=>{      
    let sql = 'SELECT * FROM TRENDING';
    conn.query(sql, function(err, result){            
        res.render('index', {trending: result, usersArray: usersArray, session: req.session}); //trending.push(...result);    
    });     
});


app.get('/login', isNotAuthenticated, (req, res)=>{
    res.render('login');
});
app.post('/login', (req, res)=>{
    const loginEmail = req.body.email;
    const loginPassword = req.body.password;

    let sql = 'SELECT * FROM users WHERE Email=?';
    conn.query(sql, [loginEmail], async (err, found)=>{        

        // Found someone
        if(found[0]){            
            try{                
                if(await bcrypt.compare(loginPassword, found[0].Password)){
                    req.session.loggedIn = true;
                    req.session.name = found[0].Name;
                    req.session.email = found[0].Email;
                    req.session.u_id = found[0].u_id;
                    res.redirect('/')
                    console.log('Logged in...');
                }
                else{
                    console.log('Incorrect password...');
                    res.redirect('/login');
                }
            } catch(e){
                console.log(e);
                res.redirect('/login');
            }
        }
        else{
            console.log('User not found...'); //no user found
            res.redirect('/login');
        }
    })
})


app.get('/register', isNotAuthenticated, (req, res)=>{
    res.render('register');
});
app.post('/register', async (req, res)=>{
    try{
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user  = {
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword
        }

        let sql = "SELECT Email FROM users WHERE Email=?";
        conn.query(sql, [user.email], (err, result)=>{
            if(!err){
                if(result[0]){
                    console.log('User exists...');
                    res.redirect('/register');
                }
                else{
                    // registering user        
                    sql = 'INSERT INTO users(Name, Email, Password) VALUES (?,?,?)';
                    conn.query(sql, [user.name, user.email, user.password], (err, data)=>{
                        if(!err){
                            req.session.loggedIn = true;                            
                            req.session.name = user.name;
                            req.session.email = user.email; 

                            conn.query('SELECT u_id FROM users WHERE email=?', [user.email], (err, result)=>{
                                if(result){
                                    req.session.u_id = result[0].u_id;
                                }
                            })
                            console.log('User registered...');
                        }
                    })                       
                    res.redirect('/');
                }
            }
        })                    
    } catch(e){
        console.log(e);
        res.redirect('/register');
    }
})


app.get('/logout', isAuthenticated, (req, res)=>{
    req.session.destroy();
    console.log('Logged out...');
    res.redirect('/login');
})


app.get('/ask', isAuthenticated, (req, res)=>{    
    res.render('ask', {session: req.session})
})
app.post('/ask', (req, res)=>{    
    let question = req.body.question;     
    if(question){
        try{
            let sql = 'INSERT INTO questions (question, u_id, name) VALUES(?,?,?)';            
            conn.query(sql, [question, req.session.u_id, req.session.name]);
            console.log('Question added');
            res.redirect('/');
        } catch{
            console.log('Error');
        }
    }    
    else{
        res.redirect('/ask')
    }
});


app.get('/answer', isAuthenticated, (req, res)=>{
    sql = 'SELECT * FROM questions';
    conn.query(sql, function(err, result){
        res.render('questions', {questionsArray: result, session: req.session}); 
    });    
});
app.post('/answer', isAuthenticated,(req, res)=>{
    const selectedQuestionId = req.body.listGroupRadio;
    req.session.q_id = selectedQuestionId;
    res.redirect('/new-post');
})  


app.get('/new-post', isAuthenticated, (req, res)=>{
    let sql = 'SELECT question FROM questions WHERE q_id=?';
    try{
        conn.query(sql,[req.session.q_id], (err, qstn)=>{
            if(qstn[0]){                
                let question = qstn[0].question;
                req.session.question = question;
                res.render('new-post', {session: req.session, question: question});
            }
            else{
                res.redirect('/');
            }
        })
    }
    catch(e){
        console.log(e);
    }    
})
app.post('/new-post', isAuthenticated, (req, res)=>{
    let sql = 'INSERT INTO posts(question, answer, u_id, q_id, name) VALUES (?,?,?,?,?)';
    conn.query(sql, [req.session.question, req.body.answer, req.session.u_id, req.session.q_id, req.session.name], (err, result)=>{
        if(!err){
            console.log('Posted successfully');
            delete req.session.question;
            delete req.session.q_id;

            res.redirect('/');
        }
        else{
            console.log("Couldn't post");
            res.redirect('/new-post');
        }
    })
    
})


app.get('*', isAuthenticated, (req, res) => {
    res.status(404).render('404', {session: req.session});
  });

app.listen(port);
console.log('The magic happens on port ' + port);