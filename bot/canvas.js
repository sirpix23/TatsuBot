var fs = require('fs');
var async = require('async');
var redis = require('redis');
var client = redis.createClient(); //creates a new client
var request = require('request');
var urlRequest = require('request').defaults({ encoding: null });
var Canvas = require('canvas')
  , Image = Canvas.Image
  , canvas = new Canvas(200, 200)
  , ctx = canvas.getContext('2d');

// A simple helper function to load image data from the file system. i'm not gonna annotate this function because it's boring. 
// Suffice to say that it turns data into pixels and other than that just accept it ok, gosh.
function loadFile(path, cb){
  fs.readFile(path, function(err, data){
    if (err) throw err
    img = new Image
    img.onload = function() {
      cb(img)
    }
    img.src = data
  });
}

function loadFileUrl(imgUrl, cb){
	urlRequest.get(imgUrl, function (err, res, data) {
		if (err) throw err
		img = new Image
		img.onload = function() {
		  cb(img)
		}
		var b64string = data;
		var buf = new Buffer(b64string, 'base64'); // Ta-da
		img.src = buf
	});
}

/*
function loadFileUrl(webUrl, cb){
	urlRequest.get(webUrl, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body);
			if (error) throw error
			img = new Image
			img.onload = function() {
			  cb(img)
			}
			img.src = data
		}
	});
}
*/


exports.canvasTest = function(callback){
	loadFileUrl('https://pbs.twimg.com/profile_images/675002642196729857/A0OpcJpA.png', 
	function(img){
	// get the size of the image. i suppose i could hardcode this, it'll never change. oh well. lazy.
		var width = img.width;
		var height = img.height;

		// make a new canvas that is the same size as the overlay image, because we wouldn't want to let that get distorted or lose any fidelity
		canvas = new Canvas(width, height);

		// get that context
		ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0, width, height);
		ctx.font = "40pt Calibri";
		ctx.fillText("TESTING TEXT!", 50,50);
		//fs.writeFileSync('current.png', canvas.toDataURL());
		//console.log(canvas.toDataURL());	
		callback(canvas.toBuffer());
	});
	
}

