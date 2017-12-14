const express = require('express');
const api = express.Router();
const https = require('https');
const session = require('express-session');
const cookieParser = require('cookie-parser');
var mysql = require('mysql');
var moment = require('moment');
// all the constants are saved on this file ... 
var consts = require('../config/consts');

const globalHost = consts.globalHost
const client_secret = consts.client_secret

//creating mysql connection
var con = mysql.createConnection({
			  host: consts.mysqlHost,
			  user: consts.mysqlUsername,
			  password: consts.mysqlPassword,
			  database: consts.mysqlDatabase
			});
	con.connect(function(err) {
		if (err) throw err
		});

var updateUserFlag;
var createUserFlag;
var generateTokenFlag;

api.use(cookieParser());
api.use(session({resave: true, saveUninitialized: true,secret: 'ssshhhhh'}));

api.all('/',function(req,res) {
	//initializing variable to default values
	updateUserFlag = false;
	createUserFlag = false;
	generateTokenFlag = false;
	
	//get current time and code from request
	var current_time = new Date();
	req.session.response_code = req.query.code;
	
	//generate access token 
	generateToken(req,(err,data) =>{
		//if access token generated record token generated time and redirect to application
		if(data==true){
			req.session.tokenGeneratedTime = current_time;
					console.log('everything right')
					res.redirect('/photoroster/index');
		}
		else{
			console.log('error in generateToken')
		}
	})
	
})

//generate access token 
function generateToken(req,callback) {
	
	var json = ''
	var optionsGenerateToken = {
        hostname: globalHost,
        path: '/login/oauth2/token?grant_type=authorization_code&client_id='+consts.client_id+'&client_secret='+client_secret+'&redirect_uri=https://cite7.nwmissouri.edu/photoroster&code='+req.session.response_code,
        method: 'POST'
       };
    
      var generateAccessToken = function(response) {
            response.on('data', function (body) {    
            json += body;     
        });

        response.on('end',function() {
            json = JSON.parse(json);
			//updating session
			req.session.token = json.access_token;
			req.session.refresh_token = json.refresh_token
			req.session.expires_in = json.expires_in;
			
			//check if user is there in database
			  con.query("SELECT * FROM authorize WHERE nwID = '"+req.session['username']+"'", function (err, result, fields) {
				if (err) throw err;
				//if user exists then update user
				if(result.length > 0) {
					updateUser(req,json,(err,data) =>{
						if(data == true) {
						generateTokenFlag = true;
						callback(err,generateTokenFlag);
						}
						else {
							generateTokenFlag = false;
							callback(err,generateTokenFlag);
						}
					});
					
				}
				//else add user to database
				else {
					addUser(req,json,(err,data)=>{
						if(data==true){
						generateTokenFlag = false;
						callback(err,generateTokenFlag);
						}
					});
				}
			  });
		});
	  }
	  var accReq = https.request(optionsGenerateToken,generateAccessToken);
      accReq.end();
	  
    return generateTokenFlag;
}

function updateUser(req,json,callback) {
	
	//convert to sql datetime
			var now = moment().format('YYYY-MM-DD HH:mm:ss');
			var addHours = moment().add(1,'hours').format('YYYY-MM-DD HH:mm:ss');
			
	//updating to database
				var sql = "UPDATE authorize SET accessToken = '"+json.access_token+"',refreshToken = '"+json.refresh_token+"',expiryDate = '"+addHours+"',dateUpdated = '"+now+"',dateCreated = '"+now+"' WHERE nwID = '"+req.session['username']+"'";
				
					con.query(sql, function (err, result) {
							if (err) throw err;
							if(result.affectedRows>0){
							console.log(result.affectedRows + " record(s) updated");
							updateUserFlag = true;
							callback(err,updateUserFlag);
							}
					});
			
}

function addUser(req,json,callback) {
	//convert to sql datetime
			var now = moment().format('YYYY-MM-DD HH:mm:ss');
			var addHours = moment().add(1,'hours').format('YYYY-MM-DD HH:mm:ss');
			
	//inserting to database
				var sql = "INSERT INTO authorize (nwID,accessToken,refreshToken,expiryDate,dateUpdated,dateCreated) VALUES ('"+req.session['username']+"','"+json.access_token+"','"+json.refresh_token+"','"+addHours+"','"+now+"','"+now+"')";
				console.log('sql statement'+sql);
					con.query(sql, function (err, result) {
							if (err) {
								console.log(err)
								createUserFlag = false;
								callback(err,createUserFlag);
							}
							else{
								console.log(result.affectedRows + " record(s) updated");
								createUserFlag = true;
								callback(err,createUserFlag);
							}
					});
			
}

module.exports = api;