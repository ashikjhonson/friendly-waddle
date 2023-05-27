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

// execute queries
const executeQuery = (query) => {
    return new Promise((resolve, reject) => {
      conn.query(query, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  };

const executeInsertQuery = (query, values) => {
    return new Promise((resolve, reject) => {
        conn.query(query, values, (err, res) => {
        if (err) {
            reject(err);
        } else {
            resolve(res);
        }
        });
    });
};


// Routes
app.get('/', isAuthenticated, async (req, res)=>{          
    try{
        const trending = await executeQuery('SELECT * FROM trending');
        const posts = await executeQuery('SELECT * FROM posts ORDER BY created_at DESC LIMIT 10');
        req.session.active = 'home';
        res.render('index', {trending: trending, posts: posts, session: req.session});
    }
    catch{
        res.status(500).send('Error');
    }    
});




app.get('/ask', isAuthenticated, (req, res)=>{    
    req.session.active = 'ask';
    res.render('ask', {session: req.session})
})
app.post('/ask', (req, res)=>{    
    let question = req.body.question;     
    if(question){
        try{                        
            executeInsertQuery('INSERT INTO questions (question, u_id, name) VALUES(?,?,?)', [question, req.session.u_id, req.session.name]);
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


app.get('/answer', isAuthenticated, async (req, res)=>{
    const questions = await executeQuery('SELECT * FROM questions ORDER BY answered, created_at LIMIT 4');
    req.session.active = 'answer';
    res.render('questions', {questions: questions, session: req.session});    
});
app.post('/answer', isAuthenticated,(req, res)=>{
    req.session.q_id = req.body.listGroupRadio;    
    if(req.session.q_id){
        res.redirect('/new-post');
    }
    else{
        res.redirect('/answer');
    }
})  


app.get('/new-post', isAuthenticated, async (req, res)=>{    
    try{
        if(req.session.q_id){
            const qn = await executeInsertQuery('SELECT question FROM questions WHERE q_id=?',[req.session.q_id]);
            req.session.question = qn[0].question;        
            res.render('new-post', {session: req.session});
        }
        else{
            res.redirect('/');
        }
    }
    catch(e){
        console.log(e);
        res.redirect('/');
    }    
})
app.post('/new-post', isAuthenticated, (req, res)=>{
    let query = 'INSERT INTO posts(question, answer, u_id, q_id, name) VALUES (?,?,?,?,?)';
    executeInsertQuery(query, [req.session.question, req.body.answer, req.session.u_id, req.session.q_id, req.session.name])
    .then(async  ()=>{        
        await executeInsertQuery('UPDATE questions SET answered=? WHERE q_id=?',[1, req.session.q_id]);
        console.log('Posted successfully');
        delete req.session.question;
        delete req.session.q_id;
        res.redirect('/');
    })
    .catch( err=>{
        console.log("Couldn't post");
        res.redirect('/new-post');
    })  
})

app.get('/following', isAuthenticated, (req, res)=>{
    req.session.active = 'following';
    res.render('404', {session: req.session});
})


app.get('/notifications', isAuthenticated, (req, res)=>{
    req.session.active = 'notifications';
    res.render('404', {session: req.session});
})

app.get('/profile', isAuthenticated, async (req, res)=>{
    req.session.active = '';
    const user = await executeInsertQuery('SELECT Name, Email, About, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM users WHERE u_id=?', [req.session.u_id]);
    const questions = await executeInsertQuery('SELECT q_id, question, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM questions WHERE u_id=? ORDER BY Date DESC', [req.session.u_id]);
    const posts = await executeInsertQuery('SELECT p_id, question, answer, q_id, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM posts WHERE u_id=? ORDER BY Date DESC', [req.session.u_id]);

    res.render('profile', {session: req.session, user: user[0], questions: questions, posts: posts});
})


app.post('/update-profile', isAuthenticated, async(req, res)=>{
    await executeInsertQuery('UPDATE posts SET name=?, About=? WHERE u_id=?',[req.body.name, req.body.about, req.session.u_id]);
    await executeInsertQuery('UPDATE questions SET name=? WHERE u_id=?',[req.body.name, req.session.u_id]);
    await executeInsertQuery('UPDATE users SET Name=?, About=? WHERE Email=?', [req.body.name, req.body.about, req.body.email]);
    console.log('Updated');
    res.redirect('/profile');
})


app.get('/delete-question/:q_id/:u_id', isAuthenticated, async(req, res)=>{
    if(req.params.u_id==req.session.u_id){
        await executeInsertQuery('DELETE FROM posts WHERE q_id=?',[req.params.q_id]);
        await executeInsertQuery('DELETE FROM questions WHERE q_id=?',[req.params.q_id]);
        console.log('Deleted question');
        res.redirect('/profile');
    }else{
        res.redirect('/');
    }
})

app.get('/delete-post/:p_id/:u_id', isAuthenticated, async(req, res)=>{
    if(req.params.u_id==req.session.u_id){
        await executeInsertQuery('DELETE FROM posts WHERE p_id=?',[req.params.p_id]);
        console.log('Deleted post');
        res.redirect('/profile');
    }else{
        res.redirect('/');
    }
})

// Modified route to profile instead of home here
app.get('/login', isNotAuthenticated, (req, res)=>{
    res.render('login');
});
app.post('/login', async (req, res)=>{
    const loginEmail = req.body.email;
    const loginPassword = req.body.password;
    const found = await executeInsertQuery('SELECT * FROM users WHERE Email=?', [loginEmail]);
    if(found[0]){            
        try{                
            if(await bcrypt.compare(loginPassword, found[0].Password)){
                req.session.loggedIn = true;
                req.session.name = found[0].Name;
                req.session.email = found[0].Email;
                req.session.u_id = found[0].u_id;
                console.log('Logged in...');
                res.redirect('/profile')
            }
            else{
                console.log('Incorrect password...');
                res.redirect('/login');
            }
        } 
        catch(e){
            console.log(e);
            res.redirect('/login');
        }
    }
    else{
        console.log('User not found...'); //no user found
        res.redirect('/login');
    }
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
        const result = await executeInsertQuery("SELECT Email FROM users WHERE Email=?", [user.email]);
        if(result[0]){
            console.log('User exists...');
            res.redirect('/register');
        }
        else{
            // registering user        
            await executeInsertQuery('INSERT INTO users(Name, Email, Password) VALUES (?,?,?)', [user.name, user.email, user.password]);
            req.session.loggedIn = true;                            
            req.session.name = user.name;
            req.session.email = user.email; 
            const result = await executeInsertQuery('SELECT u_id FROM users WHERE email=?', [user.email]);
            req.session.u_id = result[0].u_id;
            console.log('User registered...');                     
            res.redirect('/');
        }                  
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


app.get('*', isAuthenticated, (req, res) => {
    res.status(404).render('404', {session: req.session});
});

app.listen(port);
console.log('The magic happens on port ' + port);