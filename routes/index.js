
/*
 * Social Feed Cache
 */

var http = require('http'), url = require('url'), getopts = require('getopts'),
	youtube = require('youtube-feeds'), facebook = require('fbgraph'), twitter = require('twitter-api').createClient(), 
	fbconfig = {id:"facebook-id", secret:"facebook-secret"},
	mongo = require('mongodb'), mongoClient = mongo.MongoClient, mongoConnStr = "mongodb://localhost:27017/socialfeeds";

twitter.setAuth ( 
	    'your consumer key',
	    'your consumer secret', 
	    'some access key',
	    'some access secret' 
	);
	
/**
 * 
 * @param source [twitter, facebook, youtube]
 * @param sourceId [social handle]
 * @param cb [callback]
 */
function findSocialFeedCache (req, res, source) {
	var query = url.parse(req.url, true).query, ret = "", now = new Date(), timestamp = now.getTime(),
	key = query.key || null, source = source || null, sourceId = query.sourceId || null,
	now = new Date(), timestamp = now.getTime(), default_expiration = (timestamp + (60000 * 10)), expiration = parseInt(query.expiration) || null;
	
	function logError (feederror) {
		mongoClient.connect(mongoConnStr, function (err, db){
			db.collection('errors').insert({key:key, source:source, error: feederror, createdate: now}, function (err, records) {
				if (err instanceof Error) {
					console.log(err);
				}
				db.close();
			});
		});
	}
	
	function getSocialFeed (source, sourceId, cb) {
		switch (source) {
			case 'facebook':
				facebook.authorize({
				      "client_id":      fbconfig.id
				      , "client_secret":  fbconfig.secret
				      , "grant_type":     "client_credentials"
				    }, 
				    function (authErr, authRes){
					    if (!authErr) {
					    	facebook.get(sourceId + "/feed", function (err, data){
					    		if (err) {
					    			logError(err);
					    			data = null;
					    		}
					    		cb(data);
							});
					    }else{
					    	logError(authError);
					    	cb(null);
					    }
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
			res.end('error: invalid key, must not contain special characters other than - or _');
		}
		
		if (source.match(/[^a-zA-Z]/)) {
			res.end('error: invalid source supported: [facebook, twitter, youtube]');
		}
		
		if (sourceId.match(/[^a-zA-Z0-9_-]/)) {
			res.end('error: invalid source id, must not contain special characters other than - or _');
		}
		
		if (expiration != null && ((new Date(expiration)).getTime() > 0) == false) {
			res.end('error: invalid expiration timestamp, must be equivalent to javascript Date.getTime().');
		}
		
		mongoClient.connect(mongoConnStr, function (err, db){
			if (err instanceof Error) {
				logError(err);
				res.end();
			}else{
				db.collection('feeds').findOne({key:key, source:source, sourceId: sourceId}, function (err, record) {
					var ret = {};
					if (err instanceof Error) {
						logError(err);
						res.end();
					}else{
						if (record == null) {
							getSocialFeed(source, sourceId, function (data) {
								if (data != null && typeof data.error == "undefined") {
									db.collection('feeds').insert({key:key, source:source, sourceId:sourceId, feed:data, lastmod: timestamp}, function (err, records) {
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
							var doc_expiration = expiration || timestamp;
							if ((record.expiration < doc_expiration) || (expiration && expiration < timestamp)) {
								getSocialFeed(source, sourceId, function (data) {
									if (data != null && typeof data.error == "undefined") {
										db.collection('feeds').update({key:key, source:source}, {'$set':{feed:data, lastmod: timestamp, expiration: expiration || default_expiration}}, function (err, records) {
											if (err instanceof Error) {
												logError(err);
											}
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
		res.end("error: invalid parameters");
	}
}


exports.facebook = function(req, res){
	findSocialFeedCache(req, res, "facebook");
};

exports.twitter = function (req, res) {
	findSocialFeedCache(req, res, "twitter");
};

exports.youtube = function (req, res) {
	findSocialFeedCache(req, res, "youtube");
};

exports.errors = function (req, res) {
	mongoClient.connect(mongoConnStr, function (err, db){
		db.collection('errors').find().toArray(function (err, records) {
			res.end(JSON.stringify(records));
			db.close();
		});
	});
}