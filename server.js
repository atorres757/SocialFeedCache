var http = require('http'), url = require('url'), 
	youtube = require('youtube-feeds'), facebook = require('fbgraph'), twitter = require('twitter-api').createClient(), 
	mongo = require('mongodb'), mongoClient = mongo.MongoClient;

twitter.setAuth ( 
	    'your consumer key',
	    'your consumer secret', 
	    'some access key',
	    'some access secret' 
	);

var proxy = http.createServer(function (req, res){
	var query = url.parse(req.url, true).query, ret = "", now = new Date(), timestamp = now.getTime(),
	key = query.key || null, source = query.source || null, sourceId = query.sourceId || null;
	
	function logError (feederror) {
		mongoClient.connect("mongodb://localhost:27017/socialfeeds", function (err, db){
			db.collection('errors').insert({key:key, source:source, error: feederror, createdate: now}, function (err, records) {
				if (err instanceof Error) {
					console.log(err);
				}
				db.close();
			});
		});
	}
	
	function getSocialFeed (key, source, sourceId, cb) {
		switch (source) {
			case 'facebook':
				facebook.get(sourceId, function (err, data){
					if (err instanceof Error) {
						logError(err);
						data = null;
					}
					cb(data);
				});
				break;
			case 'twitter':
				twitter.get( 'statuses/user_timeline', { screen_name: sourceId }, function( data, err, status ){
					if (err instanceof Error) {
						logError(err);
						data = null;
					}
					cb(data);
				} );
				break;
			case 'youtube':
				youtube.feeds.videos({q:sourceId}, function (err, data) {
					if (err instanceof Error) {
						logError(err);
						data = null;
					}
					cb(data);
				});
				break;
			default:
				cb();
				break;
		}
	}
	
	if (key != null && source != null && sourceId != null) {
		
		// validate data
		if (key.match(/[^a-zA-Z0-9_-]/)) {
			res.end('invalid key, must not contain special characters other than - or _');
		}
		
		if (source.match(/[^a-zA-Z]/)) {
			res.end('invalid source supported: [facebook, twitter, youtube]');
		}
		
		if (sourceId.match(/[^a-zA-Z0-9_-]/)) {
			res.end('invalid source id, must not contain special characters other than - or _');
		}
		
		mongoClient.connect("mongodb://localhost:27017/socialfeeds", function (err, db){
			if (err instanceof Error) {
				logError(err);
				res.end();
			}else{
				db.collection('feeds').findOne({key:key, source:source}, function (err, record) {
					var ret = {};
					if (err instanceof Error) {
						logError(err);
						res.end();
					}else{
						if (record == null) {
							getSocialFeed(key, source, sourceId, function (data) {
								if (data != null && typeof data.error == "undefined") {
									db.collection('feeds').insert({key:key, source:source, feed:data, lastmod: timestamp}, function (err, records) {
										if (err instanceof Error) {
											logError(err);
										}
										db.close();
										res.end(JSON.stringify(data));
									});
								}else{
									res.end();
								}
							});
						}else{
							if ((timestamp - record.lastmod) > (60 * 60 * 10)) {
								getSocialFeed(key, source, sourceId, function (data) {
									if (data != null && typeof data.error == "undefined") {
										db.collection('feeds').update({key:key, source:source}, {feed:data, lastmod: timestamp}, function (err, records) {
											if (err instanceof Error) {
												logError(err);
											}
											console.log('refreshed cache');
											db.close();
											res.end(JSON.stringify(data));
										});
									}else{
										res.end(JSON.stringify(record.feed));
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
		res.end("invalid parameters");
	}
}).listen(3000, '192.168.43.128');