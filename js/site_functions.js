$(function(){
  $.ajax({
    url: 'https://geoip-db.com/json/',
    type: 'GET',
    dataType: 'json',
    success: function(data) {
      var location = data;
      var city = location.city;
      $('#user-location').text(city)
      $('.location-vis').addClass('active');
      
    }
  });
});