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

exports.canvasTest = function(callback){
	loadFileUrl('http://puu.sh/oHhfN/b9a63723b6.jpg', 
	function(img){
	// get the size of the image. i suppose i could hardcode this, it'll never change. oh well. lazy.
		var width = 360;
		var height = 100;

		// make a new canvas that is the same size as the overlay image, because we wouldn't want to let that get distorted or lose any fidelity
		canvas = new Canvas(width, height);

		// get that context
		ctx = canvas.getContext('2d');
		
			
		ctx.drawImage(img, 4, 4, 352, 92);
		
		ctx.globalAlpha=0.6;
		ctx.fillStyle = 'rgba(255,255,255,1)';
		ctx.fillRect(103, 4, 254, 92);
		
		ctx.globalAlpha=1.0;
		
		ctx.strokeStyle = 'rgba(76,76,76,1)';
		ctx.lineWidth = 1;
		ctx.strokeRect(3, 3, 354, 94);
		ctx.shadowColor = 'rgba(76,76,76)';
		ctx.shadowBlur = 5;
		
		
		ctx.font = "20pt Calibri";
		ctx.fillStyle = '#4c4c4c';
		ctx.fillText("TESTING", 100,50);
		//fs.writeFileSync('current.png', canvas.toDataURL());
		//console.log(canvas.toDataURL());	
		
		//ctx.rect(3, 103, 100, 64);
		//ctx.fillStyle = 'black';
		//ctx.fill();
		//ctx.strokeStyle = 'rgba(76,76,76,0.3)';
		//ctx.stroke();
		
		callback(canvas.toBuffer());
	});
	
}

