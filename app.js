require('dotenv').config();
const express = require('express');
const session = require('express-session')
const flash = require('connect-flash')
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const MemoryStore = require('memorystore')(session);

const app = express();
const port = 3301;

app.set('view engine', 'ejs');
app.use(flash())
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
        const posts = await executeInsertQuery('SELECT p.*, CASE WHEN l.p_id IS NOT NULL THEN 1 ELSE 0 END AS is_liked FROM posts p LEFT JOIN likes l ON p.p_id = l.p_id AND l.u_id = ? ORDER BY p.created_at DESC LIMIT 10', [req.session.u_id]);                
        req.session.active = 'home';
        res.render('index', {posts: posts, session: req.session, flashMessage: req.flash('info')});
    }
    catch(e){
        console.log(e);
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
            req.flash('info', 'Added question')            
        } catch{
            req.flash('info', 'Error while adding question')            
        }
        res.redirect('/');
    }    
    else{
        res.redirect('/ask')
    }
});


app.get('/answer', isAuthenticated, async (req, res)=>{
    const questions = await executeQuery("SELECT q.*, DATE_FORMAT(q.created_at, '%d-%m-%Y') AS date FROM questions q ORDER BY q.answered, q.created_at LIMIT 5");
    req.session.active = 'answer';
    res.render('questions', {questions: questions, session: req.session, flashMessage: req.flash('info')});    
});  


app.get('/new-post', isAuthenticated, async (req, res)=>{        
    try{
        if(req.query.q_id){
            const qn = await executeInsertQuery('SELECT question FROM questions WHERE q_id=?',[req.query.q_id]);
            req.session.question = qn[0].question;        
            req.session.q_id = req.query.q_id;
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
app.post('/new-post', isAuthenticated, async (req, res)=>{
    const about = await executeInsertQuery('SELECT About FROM users WHERE u_id=?', [req.session.u_id]);    
    await executeInsertQuery('INSERT INTO posts(question, answer, u_id, q_id, name, About) VALUES (?,?,?,?,?,?)', [req.session.question, req.body.answer, req.session.u_id, req.session.q_id, req.session.name, about[0].About])
    .then(async  ()=>{        
        await executeInsertQuery('UPDATE questions SET answered=?, replies = replies+1 WHERE q_id=?',[1, req.session.q_id]);
        req.flash('info', 'Posted sucessfully')
        delete req.session.question;
        delete req.session.q_id;
        res.redirect('/');
    })
    .catch( err=>{        
        req.flash('info', "Couldn't post")
        res.redirect('/new-post');
    })  
})


app.get('/following', isAuthenticated, async(req, res)=>{
    req.session.active = 'following';
    const waddles = await executeQuery('SELECT * FROM users');
    res.render('users', {session: req.session, waddles: waddles});
})

app.get('/guidelines', (req, res)=>{
    req.session.active = 'notifications';
    res.render('guidelines', {session: req.session});
})


app.get('/notifications', isAuthenticated, (req, res)=>{
    req.session.active = 'notifications';
    res.render('notifications', {session: req.session});
})

app.get('/profile', isAuthenticated, async (req, res)=>{
    req.session.active = '';
    const user = await executeInsertQuery('SELECT Name, Email, About, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM users WHERE u_id=?', [req.session.u_id]);
    const questions = await executeInsertQuery('SELECT q_id, question, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM questions WHERE u_id=? ORDER BY Date DESC', [req.session.u_id]);
    const posts = await executeInsertQuery('SELECT p_id, question, answer, q_id, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM posts WHERE u_id=? ORDER BY Date DESC', [req.session.u_id]);
    const likes = await executeInsertQuery('SELECT SUM(likes) AS t_likes FROM posts WHERE u_id=?', [req.session.u_id]);        
    res.render('profile', {session: req.session, user: user[0], questions: questions, posts: posts, flashMessage: req.flash('info'), likes: likes});
})


app.get('/posts-view-post-:pid', async (req, res)=>{
    const post = req.session.u_id? await executeInsertQuery('SELECT p.*, CASE WHEN l.p_id IS NOT NULL THEN 1 ELSE 0 END AS is_liked FROM posts p LEFT JOIN likes l ON p.p_id = l.p_id AND l.u_id = ? WHERE p.p_id = ?',[req.session.u_id, req.params.pid]): await executeInsertQuery('SELECT * FROM posts WHERE p_id=?',[req.params.pid]);
    const comments = await executeInsertQuery("SELECT c.*, DATE_FORMAT(c.created_at, '%d-%m-%Y') AS date FROM comments c WHERE c.post_id=?",[req.params.pid]);
    if(post[0])
        res.render('post', {session: req.session, post: post[0], comments: comments, flashMessage: req.flash('info')}) 
    else
        res.redirect('/');
})

app.get('/questions-view-question-:qid', async (req, res)=>{
    const ans = await executeInsertQuery('SELECT * FROM posts WHERE q_id=? ORDER BY likes desc', [req.params.qid]);
    if(ans[0])
        res.render('question', {session: req.session, ans: ans})
    else{
        req.flash('info', 'No answers yet!!!');
        res.redirect('/answer')
    }        
})

app.post('/new-comment', isAuthenticated, async (req, res)=>{
    try{                
        const p_id = req.query.p_id;
        await executeInsertQuery('INSERT INTO comments(post_id, comment, user_id, name) VALUES (?,?,?,?)', [p_id, req.body.reply, req.session.u_id, req.session.name]);
        req.flash('info', 'Added your reply');
        res.redirect('/posts-view-post-'+p_id);
    }
    catch{
        res.sendStatus(500);
    }
})


app.get('/users/:name/:u_id', async (req, res)=>{

    const user = await executeInsertQuery('SELECT Name, Email, About, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM users WHERE u_id=?', [req.params.u_id]);
    const questions = await executeInsertQuery('SELECT q_id, question, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM questions WHERE u_id=? ORDER BY Date DESC', [req.params.u_id]);
    const posts = await executeInsertQuery('SELECT p_id, question, answer, q_id, DATE_FORMAT(created_at, "%d-%m-%Y") AS Date FROM posts WHERE u_id=? ORDER BY Date DESC', [req.params.u_id]);
    const likes = await executeInsertQuery('SELECT SUM(likes) AS t_likes FROM posts WHERE u_id=?', [req.params.u_id]);
    if(user[0]){
        res.render('user', {session: req.session, user: user[0], questions: questions, posts: posts, likes: likes});
    }
    else{
        res.redirect('/');
    }
})


app.post('/update-profile', isAuthenticated, async(req, res)=>{
    await executeInsertQuery('UPDATE posts SET name=?, About=? WHERE u_id=?',[req.body.name, req.body.about, req.session.u_id]);
    await executeInsertQuery('UPDATE questions SET name=? WHERE u_id=?',[req.body.name, req.session.u_id]);
    await executeInsertQuery('UPDATE users SET Name=?, About=? WHERE Email=?', [req.body.name, req.body.about, req.body.email]);
    req.flash('info', 'Profile updated successfully')
    res.redirect('/profile');
})


app.get('/delete-question/:q_id/:u_id', isAuthenticated, async(req, res)=>{
    try {           
        await executeInsertQuery('DELETE FROM posts WHERE q_id=?',[req.params.q_id]);
        await executeInsertQuery('DELETE FROM questions WHERE q_id=?',[req.params.q_id]);
        req.flash('info', 'Deleted question')
        res.redirect('/profile');
    } catch (error) {
        res.redirect('/');
    }
})

app.get('/delete-post/:p_id/:u_id', isAuthenticated, async(req, res)=>{
    if(req.params.u_id==req.session.u_id){        
        await executeInsertQuery('UPDATE questions SET answered = CASE WHEN (SELECT COUNT(*) FROM posts WHERE q_id = ?) = 0 THEN 0 ELSE answered END, replies = CASE WHEN replies > 0 THEN replies - 1 ELSE replies END WHERE q_id = ?;',[req.params.q_id, req.params.q_id]);
        await executeInsertQuery('DELETE FROM posts WHERE p_id=?',[req.params.p_id]);
        req.flash('info', 'Deleted post')
        res.redirect('/profile');
    }else{
        res.redirect('/');
    }
})


app.post('/update-likes', isAuthenticated, async(req, res)=>{        
    try{        
        const action = req.query.hasOwnProperty('lp_id')? 'like':'dislike';    
        if(action=='like'){
            await executeInsertQuery("INSERT INTO likes(p_id, u_id) SELECT ?, ? WHERE NOT EXISTS( SELECT 1 FROM likes WHERE p_id=? AND u_id=?)", [req.query.lp_id, req.session.u_id, req.query.lp_id, req.session.u_id])
            .then(async()=>{
                await executeInsertQuery("UPDATE posts SET likes = (SELECT COUNT(*) FROM likes WHERE p_id=?) WHERE p_id=?", [req.query.lp_id, req.query.lp_id]);                
                res.sendStatus(200);
            })        
        }
        else{
            await executeInsertQuery("DELETE FROM likes WHERE p_id=? AND u_id=?", [req.query.dp_id, req.session.u_id])
            .then(async()=>{
                await executeInsertQuery("UPDATE posts SET likes = likes - 1 WHERE p_id=?", [req.query.dp_id]);                
                res.sendStatus(204);
            })
        }
    }
    catch{
        res.sendStatus(500);
    }
})


app.post('/search', isAuthenticated, async(req, res)=>{    
    const matchQuery = "SELECT * FROM questions WHERE question LIKE '%"+req.body.searchValue+"%' ORDER BY answered desc";
    const matches = await executeQuery(matchQuery);    
    res.render('search', {matches: matches, session: req.session});
})

app.get('/login', isNotAuthenticated, (req, res)=>{    
    res.render('login', {flashMessage: req.flash('info')});
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
                res.redirect('/')
            }
            else{
                req.flash('info', 'Incorrect password')
                res.redirect('/login');
            }
        } 
        catch(e){
            console.log(e);
            res.redirect('/login');
        }
    }
    else{
        req.flash('info', 'Incorrect email')
        res.redirect('/login');
    }
})


app.get('/register', isNotAuthenticated, (req, res)=>{
    res.render('register', {flashMessage: req.flash('info')});
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
            req.flash('info', 'Email already in use')
            res.redirect('/register');
        }
        else{
            // registering user        
            await executeInsertQuery('INSERT INTO users(Name, Email, Password, About) VALUES (?,?,?,?)', [user.name, user.email, user.password, 'Anonymous']);
            req.session.loggedIn = true;                            
            req.session.name = user.name;
            req.session.email = user.email; 
            const result = await executeInsertQuery('SELECT u_id FROM users WHERE email=?', [user.email]);
            req.session.u_id = result[0].u_id;        
            req.flash('info', "Welcome aboard! Start your journey with us.");
            res.redirect('/');
        }                  
    } catch(e){
        console.log(e);
        res.redirect('/register');
    }
})


app.get('/logout', isAuthenticated, (req, res)=>{    
    req.session.destroy();    
    res.redirect('/login');
})


app.get('*', isAuthenticated, (req, res) => {
    res.status(404).render('404', {session: req.session});
});

app.listen(port);
console.log('The magic happens on port ' + port);