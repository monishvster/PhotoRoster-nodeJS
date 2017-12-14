const http = require("http");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const json2csv = require('json2csv');
const session =  require('express-session');
const cookieParser = require('cookie-parser');



// create express app 
var app = express();

// set up the view engine
app.set("views", path.resolve(__dirname, "views")); // path to views
app.set("view engine", "ejs"); // specify our view engine

// download pdf
app.get('/photoroster/downloadPDF', function(req,res) {
	var tempFile = session['courseID'];
	var file = './photoroster/'+tempFile+'.pdf';
	res.setHeader('Content-disposition', 'attachment; filename=' + file);
	res.setHeader('Content-type', 'application/pdf');
	res.download(file);
	
});

// specify various resources and apply them to our application

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/photoroster_assets/'));  // works for views in root view folder

// Request to this URI will be handled by this CONTROLLER..........
app.use('/photoroster', require('./controllers/authenticate'));
app.use('/photoroster/redirect',require('./controllers/redirect'));
app.use('/photoroster/index', require('./controllers/index'));
app.use('/photoroster/generatePDF', require('./controllers/generatePDF'));

// handle page not found errors
app.use(function (request, response) {
	console.log('fail response: '+JSON.stringify(response.body))
	console.log('fail request: '+JSON.stringify(request.body));
  response.status(404).render("404");
});

// set port 
app.set('port',(process.env.PORT || 4001));
app.listen(app.set('port'), function(){
  console.log('Server started art port: ' + app.get('port'));
});