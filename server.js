var http = require('http'), url = require('url'), youtube = require('youtube-feeds'), facebook = require('fbgraph'), twitter = require('twitter-api'), mongo = require('mongodb'), mongoClient = mongo.MongoClient;

var proxy = http.createServer(function (req, res){
	var query = url.parse(req.url, true).query, ret = "", now = new Date(), timestamp = now.getTime(),
	key = query.key || null, source = query.source || null, sourceId = query.sourceId || null;
	
	function getSocialFeed (key, source, sourceId, cb) {
		switch (source) {
			case 'facebook':
				facebook.get(sourceId, function (err, data){
					if (err instanceof Error) {
						console.log(err);
					}else{
						cb(data);
					}
				});
				break;
			case 'twitter':
				break;
			case 'youtube':
				youtube.feeds.videos({q:sourceId}, function (err, data) {
					if (err instanceof Error) {
						console.log(err);
					}else{
						cb(data);
					}
				});
				break;
			default:
				cb();
				break;
		}
	}
	
	if (key != null && source != null && sourceId != null) {
		
		mongoClient.connect("mongodb://localhost:27017/socialfeeds", function (err, db){
			if (err instanceof Error) {
				console.log(err);
				res.end();
			}else{
				db.collection('feeds').findOne({key:key, source:source}, function (err, record) {
					var ret = {};
					console.log(record);
					if (err instanceof Error) {
						console.log(err);
						res.end();
					}else{
						if (record == null) {
							getSocialFeed(key, source, sourceId, function (data) {
								if (data != null) {
									db.collection('feeds').insert({key:key, source:source, feed:data, lastmod: timestamp}, function (err, records) {
										if (err instanceof Error) {
											console.log(err);
										}
										db.close();
										console.log(records);
										res.end(JSON.stringify(data));
									});
								}else{
									res.end();
								}
							});
						}else{
							if ((timestamp - record.lastmod) > (60 * 60 * 1)) {
								console.log('refresh cache');
								getSocialFeed(key, source, sourceId, function (data) {
									if (data != null) {
										db.collection('feeds').update({key:key, source:source}, {feed:data, lastmod: timestamp}, function (err, records) {
											if (err instanceof Error) {
												console.log(err);
											}
											db.close();
											console.log(records);
											res.end(JSON.stringify(data));
										});
									}else{
										res.end();
									}
								});
							}else{
								db.close();
								res.end(JSON.stringify(record.feed));
							}
						}
					}
				});
			}
		});
	}else{
		res.end("invalid params");
	}
}).listen(3000, '192.168.43.128');