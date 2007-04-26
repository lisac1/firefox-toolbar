/**
 * Facebook Firefox Toolbar Software License
 * Copyright (c) 2007 Facebook, Inc.
 *
 * Permission is hereby granted, free of charge, to any person or organization
 * obtaining a copy of the software and accompanying documentation covered by
 * this license (which, together with any graphical images included with such
 * software, are collectively referred to below as the "Software") to (a) use,
 * reproduce, display, distribute, execute, and transmit the Software, (b)
 * prepare derivative works of the Software (excluding any graphical images
 * included with the Software, which may not be modified or altered), and (c)
 * permit third-parties to whom the Software is furnished to do so, all
 * subject to the following:
 *
 * The copyright notices in the Software and this entire statement, including
 * the above license grant, this restriction and the following disclaimer,
 * must be included in all copies of the Software, in whole or in part, and
 * all derivative works of the Software, unless such copies or derivative
 * works are solely in the form of machine-executable object code generated by
 * a source language processor.
 *
 * Facebook, Inc. retains ownership of the Software and all associated
 * intellectual property rights.  All rights not expressly granted in this
 * license are reserved by Facebook, Inc.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE
 * FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

var Cc = Components.classes;
var Ci = Components.interfaces;

var fbSvc = Cc['@facebook.com/facebook-service;1'].getService(Ci.fbIFacebookService);
var obsSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

debug( "toolbar.js" );

var topicToXulId =  { 'facebook-msgs-updated':      'facebook-notification-msgs'
                    , 'facebook-pokes-updated':     'facebook-notification-poke'
                    , 'facebook-reqs-updated':      'facebook-notification-reqs'
                    , 'facebook-event-invs-updated':'facebook-notification-event-invs'
                    , 'facebook-group-invs-updated':'facebook-notification-group-invs'
                    };

function checkSeparator(data) {
    var showSep = false;
    for each( var elt_id in topicToXulId ) {
        if( getAttributeById( elt_id, 'label') != "0" ) {
            showSep = true;
            break;
        }
    }
    debug( 'showSep', showSep );
    setAttributeById( 'facebook-notification-separator', 'hidden'
                    , showSep ? 'false': 'true' );
}

var fbToolbarObserver = {
    observe: function(subject, topic, data) {
        debug('toolbar observing something: ', topic);
        var eltId = topicToXulId[topic];
        if( eltId ) {
            setAttributeById(eltId, 'label', data);
            checkSeparator(data);
        }
        else {
            switch (topic) {
            case 'facebook-session-start':
                subject = subject.QueryInterface(Ci.fbIFacebookUser);
                setAttributeById('facebook-name-info', 'label', subject.name);
                setAttributeById('facebook-name-info', 'userid', subject.id);
                setAttributeById('facebook-menu-my-profile', 'userid', subject.id);
                setAttributeById('facebook-login-status', 'label', 'Logout');
                var sb = GetFBSearchBox();
                if (sb.value != 'Search Facebook' && sb.value != '') {
                    sb.value = '';
                    this.searchBoxBlur(sb);
                }
                SetHint(true, 'Loading friend list...', '');
                break;
            case 'facebook-session-end':
                debug('ending session...');
                setAttributeById('facebook-login-status', 'label', 'Login to Facebook');
                setAttributeById('facebook-name-info', 'label', '');
                for each( var top in topicToXulId )
                    setAttributeById( top, 'label', '?');
                facebook.clearFriends(true);
                break;
            case 'facebook-friends-updated':
                facebook.loadFriends();
                break;
            case 'facebook-new-friend':
            case 'facebook-friend-updated':
                debug( 'friend update...' )
                subject = subject.QueryInterface(Ci.fbIFacebookUser);
                facebook.updateFriend(subject);
                break;
            case 'facebook-new-day':
                facebook.clearFriends(false);
                facebook.loadFriends();
                break;
            }
        }
    }
};

var progListener = {
    onLocationChange: function(webProgress, request, location) {
        if (fbSvc.loggedIn) {
            fbSvc.hintPageLoad(IsFacebookLocation(location));
        }
    },
    onProgressChange: function(webProgress, request, curSelfProg, maxSelfProg, curTotalProg, maxTotalProg) {  },
    onSecurityChange: function(webProgress, request, state) {  },
    onStateChange: function(webProgress, request, stateFlags, status) {  },
    onStatusChange: function(webProgress, request, status, message) {  }
};

var topics_of_interest =    [ 'facebook-session-start'
                            , 'facebook-friends-updated'
                            , 'facebook-friend-updated'
                            , 'facebook-new-friend'
                            , 'facebook-session-end'
                            , 'facebook-msgs-updated'
                            , 'facebook-pokes-updated'
                            , 'facebook-event-invs-updated'
                            , 'facebook-group-invs-updated'
                            , 'facebook-reqs-updated'
                            , 'facebook-new-day'
                            ];

var facebook = {
    load: function() {
        debug( "loading toolbar..." );
        var prefSvc = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefBranch);
        if (!prefSvc.prefHasUserValue('extensions.facebook.not_first_run')) {
          // unfortunately if we create any tabs here, session store overrides
          // them, so instead we'll create a tab in 250 ms, hopefully after
          // session store does its business.
          window.setTimeout("getBrowser().loadOneTab('chrome://facebook/content/welcome.html', null, null, null, false, false)", 250);
          prefSvc.setBoolPref('extensions.facebook.not_first_run', true);
          prefSvc.lockPref('extensions.facebook.not_first_run');
        }
        document.getElementById('facebook-search').addEventListener('keypress', HandleKeyPress, true);
        for each ( var topic in topics_of_interest ) {
            debug( "observer added", topic );
            obsSvc.addObserver(fbToolbarObserver, topic, false);
        }

        var loggedInUser = fbSvc.loggedInUser;
        if (loggedInUser) {
            loggedInUser = loggedInUser.QueryInterface(Ci.fbIFacebookUser);
            setAttributeById('facebook-name-info', 'label', loggedInUser.name);
            setAttributeById('facebook-name-info', 'userid', loggedInUser.id);
            setAttributeById('facebook-login-status', 'label', 'Logout');
            setAttributeById('facebook-menu-my-profile', 'userid', loggedInUser.id);
            setAttributeById('facebook-notification-msgs', 'label', fbSvc.numMsgs);
            setAttributeById('facebook-notification-poke', 'label', fbSvc.numPokes);
            setAttributeById('facebook-notification-reqs', 'label', fbSvc.numReqs);
            setAttributeById('facebook-notification-group-invs', 'label', fbSvc.numGroupInvs);
            setAttributeById('facebook-notification-event-invs', 'label', fbSvc.numEventInvs);
        }
        else {
          var session_key = prefSvc.getCharPref( 'extensions.facebook.session_key' );
          var session_secret = prefSvc.getCharPref( 'extensions.facebook.session_secret' );
          var uid = prefSvc.getCharPref( 'extensions.facebook.uid' );
          fbSvc.sessionStart( session_key, session_secret, uid, true );
          // fbSvc.savedSessionStart(); // once idl compiled
        }
        facebook.loadFriends();
        getBrowser().addProgressListener(progListener);
        debug('facebook toolbar loaded.');
        },
    unload: function() {
        for each (var topic in topics_of_interest)
            obsSvc.removeObserver(fbToolbarObserver, topic);
        if( fbSvc.loggedInUser )

        debug('facebook toolbar unloaded.');
    },
    sortFriends: function(f1, f2) {
        var n1 = f1.name.toLowerCase();
        var n2 = f2.name.toLowerCase();
        if (n1 < n2) return -1;
        else if (n1 > n2) return 1;
        else return 0;
    },
  loadFriends: function() {
    debug('loadFriends()');
    var list = document.getElementById('PopupFacebookFriendsList');
    if (list.firstChild && list.firstChild.id != 'FacebookHint') {
      return;
    }
    list.selectedIndex = -1;
    var count = {};
    var friends = fbSvc.getFriends(count);
    debug('got friends', count.value);
    if (!fbSvc.loggedIn) {
      SetHint(true, 'Log in from the toolbar to see your friend list.', 'FacebookLogin()');
    } else if (!count.value) {
      SetHint(true, 'Loading friend list...', '');
    } else {
      friends.sort(this.sortFriends);
      for each (var friend in friends) {
        this.createFriendNode(list, friend, null);
      }
      if (!IsSidebarOpen()) {
        SearchFriends(GetFBSearchBox().value);
      }
    }
  },
  updateFriend: function(friend) {
    debug( 'updating friend...' );
    var elem = document.getElementById('popup-' + friend.id);
    var list = document.getElementById('PopupFacebookFriendsList');
    this.createFriendNode(list, friend, elem);
  },
  createFriendNode: function(list, friend, elem) { // creates nodes in the search popup only
    if (!friend.name) return;
    if (!elem) {
      var item = document.createElement('richlistitem');
      item.setAttribute('id', 'popup-' + friend.id);
      item.setAttribute('class', 'popupFriendBox');
    } else {
      var item = elem;
    }
    item.setAttribute('friendname', friend.name);
    var firstName = friend.name.substr(0, friend.name.indexOf(' '));
    if (!firstName) firstName = friend.name;
    item.setAttribute('firstname', firstName);
    SetStatus(item, friend.status, friend.stime);
    item.setAttribute('ptime', getProfileTime(friend.ptime) );

    item.setAttribute('onmouseover', "SelectItemInList(this, this.parentNode)");
    item.setAttribute('onmousedown', "this.doCommand();");
    item.setAttribute('oncommand', "OpenFBUrl('profile.php', '" + friend.id + "', event)");
    item.setAttribute('onclick', "checkForMiddleClick(this, event)" );
    item.setAttribute('userid', friend.id);
    item.setAttribute('pic', friend.pic);
    if (!elem) {
      // Note that this will put new friends at the bottom instead of alphabetized, but I think that's ok.
      // It would get fixed in any new windows or when the browser restarts.
      list.insertBefore(item, document.getElementById('FacebookHint'));
    }
  },
  searchBoxFocus: function(searchBox) {
    if (searchBox.value == 'Search Facebook') {
      searchBox.value='';
      searchBox.style.color='#000000';
    }
    if (!this.ignoreBlur && document.getElementById('viewFacebookSidebar').getAttribute('checked') != 'true') {
      document.getElementById('PopupFacebookFriends').showPopup(searchBox, -1, -1, 'popup', 'bottomleft', 'topleft');
      // if the sidebar was just open then we would be out of sync, so let's just filter the list to be safe
      if (fbSvc.loggedIn) {
        SearchFriends(searchBox.value);
      }
    }
  },
  searchBoxBlur: function(searchBox) {
    if (!this.ignoreBlur) {
      document.getElementById('PopupFacebookFriends').hidePopup();
    }
    if (searchBox.value=='') {
      searchBox.style.color='#808080';
      searchBox.value = 'Search Facebook';
    }
  },
  share: function() {
    // not only do we need to encodeURIComponent on the string, we also need to escape quotes since
    // we are putting this into a string to evaluate (as opposed to evaluating it directly)
    var enc = function(str) {
      return encodeURIComponent(str).replace("'", "\\'", 'g');
    }
    var p = '.php?src=tb&v=4&u=' + enc(content.document.location.href) + '&t=' + enc(document.title);
    var openCmd = "window.open('http://www.facebook.com/sharer" + p + "', 'sharer','toolbar=no,status=yes,width=626,height=436');";
    try {
      // If we're not on a facebook page, just jump down to the catch block and open the popup...
      if (!IsFacebookLocation(content.document.location))
        throw null;
      // We're on a facebook page, so let's try using share_internal_bookmarklet...

      // We can access the function easily through content's wrappedJSObject, but unfortunately if
      // we try calling it directly, then the relative URL's in XMLHttpRequests are interpretted
      // relative to our current chrome:// url and fail.  So instead we check for the function...
      if (!content.wrappedJSObject.share_internal_bookmarklet)
          throw null;
      // ...and if the function is there then we have to do this lame javascript: url hack to
      // execute it.
      content.document.location = 'javascript:try { share_internal_bookmarklet("' + p + '"); } catch (e) { setTimeout("' + openCmd + '", 0); } void(0);'
    } catch(e) {
      debug('title is: ' + document.title, 'url: ' + content.document.location.href, openCmd);
      eval(openCmd);
    }
  },
  clearFriends: function(sessionEnded) {
    var list = document.getElementById('PopupFacebookFriendsList');
    while (list.firstChild && list.firstChild.id != 'FacebookHint') {
      list.removeChild(list.firstChild);
    }
    document.getElementById('PopupMessager').style.display = 'none';
    document.getElementById('PopupPoker').style.display = 'none';
    document.getElementById('PopupPoster').style.display = 'none';
    if (sessionEnded) {
      SetHint(true, 'Login from the toolbar to see your friend list.', 'FacebookLogin()');
    }
  }
};
window.addEventListener('load', facebook.load, false);
window.addEventListener('unload', facebook.unload, false);

debug('loaded toolbar.js');
