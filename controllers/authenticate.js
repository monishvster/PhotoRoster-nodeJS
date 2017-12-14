const express = require('express');
const api = express.Router();
const https = require('https');
const http = require("http");
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csv = require('fast-csv');
const fs = require('fs');
var mysql = require('mysql');
var moment = require('moment');
// all the constants are saved on this file ...
var consts = require('../config/consts');

const globalHost = consts.globalHost
const client_secret = consts.client_secret
const newaccesstoken = consts.adminAccessToken

api.use(cookieParser());
api.use(session({resave: true, saveUninitialized: true,secret: 'ssshhhhh'}));

global.crn_teacher_map = {};

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
//making flags
var generateTokenFlag;
var checkUserHealthFlag;

api.all('/', function(req,res) {
	//initializing variables to default
	var userID = '';
	var canvasID = '';
	generateTokenFlag = false;
	checkUserHealthFlag = false;

	//locating csv
    var stream = fs.createReadStream("crnFile.csv");
	req.session.body = req.body;
    var newcourseid = JSON.stringify(req.headers.referer);
    req.session.courseId = parseInt(newcourseid.substring(newcourseid.indexOf("es/") + 3,newcourseid.indexOf("/ex")));
    newuserID = JSON.stringify(req.body.custom_canvas_user_login_id);
	userID = newuserID.replace(/['"]+/g, '')
	req.session['username'] = userID;
	newcanvasID = JSON.stringify(req.body.custom_canvas_user_id);
	canvasID = newcanvasID.replace(/['"]+/g, '');
	req.session.canvasID = canvasID;

	//reading data from csv
    var csvStream = csv()
    .on("data", function(data){
        csvData = data[0] + " " + data[1];
        var key = data[0]+"";
        var value = data[1]+"";
        crn_teacher_map[key] = value;
    })
    .on("end", function(){
		//first check user in Database, if there then check access_token expiry
		checkUserinDb(userID,req,(err,data) =>{
			let currentTime = new Date();
			if(data != 'no_user') {
			let isExpired = data < currentTime;

			//if access_token expired == true, else check health of token
			if(isExpired) {
				//generate new access token
				 generateToken(req,(err,data) =>{
					 if(data == true) {
						 //if token generated then check token health
						 checkUserHealth(req,(err,data) => {
							 //if token health is fine then redirect to application else redirect to authentication
							 if(data == true) {
								 res.redirect('/photoroster/index');
							 }
							 else{
								res.redirect('https://nwmissouri.test.instructure.com/login/oauth2/auth?client_id='+consts.client_id+'&response_type=code&redirect_uri='+consts.redirect_uri)
							 }
						 });
					 }
					 else {
						 res.redirect('https://nwmissouri.test.instructure.com/login/oauth2/auth?client_id='+consts.client_id+'&response_type=code&redirect_uri='+consts.redirect_uri)
					 }
				 })
			}
			else {
				checkUserHealth(req,(err,data) => {
							 if(data == true) {
								 res.redirect('/photoroster/index');
							 }
							 else{
								res.redirect('https://nwmissouri.test.instructure.com/login/oauth2/auth?client_id='+consts.client_id+'&response_type=code&redirect_uri='+consts.redirect_uri)
							 }
						 });
				}

			}
			})



    });
  stream.pipe(csvStream);
});

//check user in database
function checkUserinDb(userID,req,callback) {
		    con.query("SELECT * FROM authorize where nwID = '"+userID+"'", function (err, result, fields) {
					  if (err) throw err;
					  if(result.length > 0 ) {
						  req.session.username = result[0].nwID;
						  req.session.token = result[0].accessToken;
						  req.session.refresh_token = result[0].refreshToken;
						  req.session.expires_in = result[0].expiryDate;
						  callback(err,req.session.expires_in);
					  }
					  else {
						  callback(err,'no_user');
					  }
			});
}

//generate access token
function generateToken(req,callback) {
	var json = ''

	var optionsGenerateToken = {
        hostname: globalHost,
        path: '/login/oauth2/token?grant_type=refresh_token&client_id='+consts.client_id+'&client_secret='+client_secret+'&refresh_token='+req.session.refresh_token,
        method: 'POST'
       };

      var generateAccessToken = function(response) {
            response.on('data', function (body) {
            json += body;
        });

        response.on('end',function() {
            json = JSON.parse(json);
			console.log(json)
			//updating session
			req.session.token = json.access_token;
			req.session.refresh_token = json.refresh_token
			req.session.expires_in = json.expires_in;

			//convert to sql datetime
			var now = moment().format('YYYY-MM-DD HH:mm:ss');
			var addHours = moment().add(1,'hours').format('YYYY-MM-DD HH:mm:ss');

			//updating to database
			var sql = "UPDATE authorize SET accessToken = '"+json.access_token+"',refreshToken = '"+json.refresh_token+"',expiryDate = '"+addHours+"',dateUpdated = '"+now+"',dateCreated = '"+now+"' WHERE nwID = '"+req.session.username+"'";
					con.query(sql, function (err, result) {
							if (err) throw err;
							if(result.affectedRows>0){
								generateTokenFlag = true;
								callback(err,generateTokenFlag);
							}
							else {
								generateTokenFlag = false;
								callback(err,generateTokenFlag);
							}
					});
		});
	  }
	  var accReq = https.request(optionsGenerateToken,generateAccessToken);
      accReq.end();
}

//check access token health
function checkUserHealth(req,callback) {
	var json = ''
	var optionsCheckHealth = {
        hostname: globalHost,
        path: '/api/v1/users/self/profile?access_token='+req.session.token,
        method: 'GET'
       };

      var checkHealth = function(response) {
				var err = 'error_occured';
              if(response.statusCode == 200) {
				  checkUserHealthFlag = true;
				  callback(err,checkUserHealthFlag);
			  }
			  else {
				  checkUserHealthFlag = false;
				  callback(err,checkUserHealthFlag);
			  }
        }

	  var accReq = https.request(optionsCheckHealth,checkHealth);
      accReq.end();
}

module.exports = api;
