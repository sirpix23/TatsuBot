var fs = require('fs');
var async = require('async');
var redis = require('redis');
var client = redis.createClient(); //creates a new client
var Canvas = require('canvas')
  , Image = Canvas.Image
  , canvas = new Canvas(200, 200)
  , ctx = canvas.getContext('2d');

exports.canvasTest = function(){
	ctx.font = '30px Impact';
	ctx.rotate(.1);
	ctx.fillText("Test Canvas", 50, 100);

	var te = ctx.measureText('Test Canvas');
	ctx.strokeStyle = 'rgba(0,0,0,0.5)';
	ctx.beginPath();
	ctx.lineTo(50, 102);
	ctx.lineTo(50 + te.width, 102);
	ctx.stroke();

	console.log('<img src="' + canvas.toDataURL() + '" />');
}

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

exports.canvasOverlayTest = function(){
	// use our helper function to load the overlay image, yeah.
	loadFile('./the_bird.png', function(img){
	  // get the size of the image. i suppose i could hardcode this, it'll never change. oh well. lazy.
	  var width = img.width
	  var height = img.height

	  // make a new canvas that is the same size as the overlay image, because we wouldn't want to let that get distorted or lose any fidelity
	  canvas = new Canvas(width, height);

	  // get that context
	  ctx = canvas.getContext('2d');

	  // load a corporation image
	  loadFile('./a_corporation.png', function(toFlip){

		// draw the corporation to the context, scaling it to the size of the canvas. 
		// The other 4 arguments are the x,y coordinates for the top-left and bottom-right corners of the image.
		ctx.drawImage(toFlip, 0, 0, width, height);

		// draw the other image on top of the corporation image. 
		// If, for example, you wanted to draw it only on the right half of the canvas you would instead pass `(img, width/2, height/2, width, height)`
		ctx.drawImage(img, 0, 0, width, height);

		// write the image to the file system
		fs.writeFileSync('current.png', canvas.toBuffer());
	  });
	});
}

exports.canvasNewTest = function(){
	//new canvas, width 400, height 100
	canvas = new Canvas(400, 100);
	
	ctx = canvas.getContext('2d');
	
	ctx.font = '30px Impact';
	ctx.fillText("Test Canvas", 50, 100);

	var te = ctx.measureText('Test Canvas');
	ctx.strokeStyle = 'rgba(0,0,0,0.5)';
	ctx.beginPath();
	ctx.lineTo(50, 102);
	ctx.lineTo(50 + te.width, 102);
	ctx.stroke();

	console.log('<img src="' + canvas.toDataURL() + '" />');
		
	function drawScrollbar () {
	  var width = parseInt($('#width').val()),
		height = parseInt($('#height').val()),
		max = parseInt($('#max').val()),
		val = Math.min(Math.max(parseInt(parseInt($('#val').val())), 0), max),
		direction = $('input[name="direction"]:checked').val();
	  
	  // Draw the background
	  ctx.fillStyle = '#000';
	  ctx.clearRect(0, 0, canvas.width, canvas.height);
	  ctx.fillRect(0, 0, width, height);

	  // Draw the fill
	  ctx.fillStyle = '#777';
	  var fillVal = Math.min(Math.max(val / max, 0), 1);
	  if (direction === 'vertical') {
		ctx.fillRect(0, 0, width, fillVal * height);
	  }
	}
}



