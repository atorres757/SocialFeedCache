SocialFeedCache
===============

An api used to retrieve public social media feeds from facebook, twitter and youtube. It uses MongoDB to cache the feed data and log errors.

Example of how to request a public YouTube feed and place an expiration on the cache:
```
http://localhost:3000/youtube?key=cachekey&sourceId=MyYoutubeHandle[&expiration=1368561578450]
```

A default expiration of 10 minutes is set if an expiration isn't provided. If you want to reset the cache, pass a js timestamp in the past.

The purpose of the cache key is to have a one to many relationship with various feeds. For example one entity can have multiple social feeds. The cachekey can be used as the id for the entity.

This project uses the following npm modules. 
* mongodb
* express
* fbgraph
* twitter-api
* youtube-feeds

## ErrorLog ##

If you want to see a list of errors go to:
```
http://localhost:3000/errors.
```

## Nice to Have ##

I'll be looking into adding some additional endpoints to return all feed data by cachekey. I'll also be looking into making the errors endpoint queryable.

