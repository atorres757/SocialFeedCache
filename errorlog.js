var http = require('http'), url = require('url'), 
	mongo = require('mongodb'), mongoClient = mongo.MongoClient;

http.createServer(function (req, res){
	
	mongoClient.connect("mongodb://localhost:27017/socialfeeds", function (err, db){
		db.collection('errors').find().toArray(function (err, records) {
			res.end(JSON.stringify(records));
		});
	});
	
}).listen(3001, '192.168.43.128')