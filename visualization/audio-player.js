class MediaPlayer {
  constructor(player, options) {
    this.player = player;
    this.progress = 0;

    /* defaults */
    this.volumeLevel = 50;
    this.volumeControls = true;
    this.seekControls = true;

    this.list = false;
    this.currentFileIndex = 0;
    this.playButtonSvg = '<svg class="icon icon-play"><use xlink:href="#icon-play"></use></svg>';
    this.pauseButtonSvg = '<svg class="icon icon-pause"><use xlink:href="#icon-pause"></use></svg>';
    this.rewindButtonSvg = '<svg class="icon icon-rewind"><use xlink:href="#icon-rewind"></use></svg>';
    this.forwardButtonSvg = '<svg class="icon icon-forward"><use xlink:href="#icon-forward"></use></svg>';
    this.downloadButtonSvg = '<svg class="icon icon-download"><use xlink:href="#icon-download"></use></svg>';
    this.starButtonSvg = '<svg class="icon icon-star"><use xlink:href="#icon-star"></use></svg>';
  }
  render(options) {
    if (options) {
      this.extend(options);
    }

    if (this.player.controls) {
      this.player.controls = false;
    }

    this.container = this.createElement('div', {
      class: 'playr'
    });

    this.player.parentNode.insertBefore(this.container, this.player);
    this.container.appendChild(this.player);

    this.initPlayer();
    this.createUI();
    this.buildList();
    this.attachHandlers();
    this.setVolume(this.volumeLevel);
  }

  initPlayer() {
    if (this.player.controls) {
      this.player.controls = false;
    }
    this.currentFile = this.list.files[this.currentFileIndex];
    console.log("currentFile", this.currentFile);
    this.player.src = this.list.files[this.currentFileIndex].audio_url;
    this.filename = this.list.files[this.currentFileIndex].filename;
    this.sentence = this.list.files[this.currentFileIndex].labels.filter(word => word !== '#').join(' ');
    displayTextGrid(this.currentFile);
    console.log("sentence", this.sentence);
    this.player.load();
  }

  /*------------------- List ------------*/
  buildList() {
    if (this.list) {

      var _scope = this;
      var listName = this.createElement('div', {
        class: 'list-name',
        html: this.list.listName
      });
      var listDiv = this.createElement('div', {
        class: 'list-ui'
      });
      var listItems = this.createElement('ul', {
        //class: 'list-ui'
        id: this.player.id + '_list'
      });
      var file;
      this.selectTrack = function(event) {
        var idarray = event.target.id.split('-');
        var selectedTrack = idarray[1];
        this.playTrack(selectedTrack);
      };
      for (var i = 0; i < this.list.files.length; i++) {
        //css += property + ': ' + properties[property] + ';';
        var listItem = this.createElement('li', {
          class: 'list-item',
          id: this.player.id + '_track-' + i,
          html: '<div id=' + this.player.id + '_item-' + i + '>' + this.list.files[i].labels.filter(word => word !== '#').join(' ') + '</div>'
        });
        listItem.addEventListener('click', this.selectTrack.bind(this), false);
        listItems.appendChild(listItem);
      }

      listDiv.appendChild(listName);
      listDiv.appendChild(listItems);
      var listContainer = document.getElementById("myList");
      this.player.parentNode.parentNode.appendChild(listDiv);

    }
  }


  playTrack(id) {
  document.getElementsByClassName("list-item")[this.currentFileIndex].classList.remove('selected');
    this.currentFileIndex = id;
    //document.getElementsByClassName("list-item").classList.remove('selected');
    document.getElementsByClassName("list-item")[this.currentFileIndex].classList.add('selected');
          //this.container.classList.add('playing');
      //this.container.classList.remove('paused');
    //$('.selected').removeClass('selected');
    //$('#plList li:eq(' + id + ')').addClass('plSel');
    this.initPlayer();
    this.createUI();
    this.attachHandlers();
    console.log(this.player.volume);
    this.setVolume(this.player.volume*100);
    this.play();
  }





  setDimensions() {
    var _scope = this;
    _scope.uiRect = _scope.container.getBoundingClientRect();
    _scope.barRect = _scope.progressBar.getBoundingClientRect();

    if (_scope.uiRect.width < 480) {
      _scope.container.classList.add('compact');
    } else {
      _scope.container.classList.remove('compact');
    }

    if (_scope.volumeControls) {
      _scope.volRect = _scope.volumeBar.getBoundingClientRect();
    }

    _scope.barLeft = _scope.progressBar.offsetLeft;
    _scope.barWidth = _scope.progressBar.offsetWidth;

    var offsetWidth = _scope.titleBox.offsetWidth;
    var scrollWidth = _scope.titleBox.scrollWidth;

    if (scrollWidth > offsetWidth) {
      _scope.titleBox.classList.add('overflow');
      _scope.titleBox.innerHTML = '<span>' + _scope.sentence + '</span><span>' + _scope.sentence + '</span>';
    } else {
      _scope.titleBox.classList.remove('overflow');
      _scope.titleBox.innerHTML = '<span>' + _scope.sentence + '</span>';
    }
  }

  attachHandlers() {
    var _scope = this;
    this.seeking = false;
    this.dragging = false;

    /* Play */
    this.playButton.addEventListener('click', this.play.bind(this));
    this.player.addEventListener('ended', this.reset.bind(this));

    /* Progress */
    this.player.addEventListener("timeupdate", this.updateProgress.bind(this), false);
    this.player.addEventListener("loadedmetadata", this.updateProgress.bind(this), false);

    /* Seek */
    this.progressBar.parentNode.addEventListener("mousedown", function(event) {
      _scope.seeking = true;
      _scope.seek(event);
    }, false);
    window.addEventListener("mousemove", this.seek.bind(this), false);

    /* Other */
    window.addEventListener("mouseup", this.mouseUp.bind(this), false);

    /* Resize */
    var timeout = null;
    window.addEventListener('resize', function(event) {
      /* debounce */
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        _scope.setDimensions();
      }, 250);
    }, false);
  }

  mouseUp(event) {
    if (this.dragging) {
      this.volX = event.clientX - this.volRect.left;
      if (this.volX >= this.volRect.width) {
        this.volX = this.volRect.width;
      } else if (this.volX <= 0) {
        this.volX = 0;
      }
      this.dragging = false;
    }
    if (this.seeking) {
      if (this.wasPlaying) {
        this.play();
        this.wasPlaying = false;
      }
      this.seeking = false;
    }
  }

  play() {
    var that = this;
    if (!!this.player.paused) {
      this.container.getElementsByTagName("div")[0].getElementsByClassName("playr-play")[0].innerHTML = this.pauseButtonSvg;
      this.container.classList.add('playing');
      this.container.classList.remove('paused');
      this.player.play();
    } else {
      this.pause();
    }
  }

  pause() {
    if (this.player.paused) return;
    this.container.classList.add('paused');
    this.container.classList.remove('playing');
    this.container.getElementsByTagName("div")[0].getElementsByClassName("playr-play")[0].innerHTML = this.playButtonSvg;
    this.player.pause();
  }

  fastForward() {
    this.player.currentTime += 5;
  }

  rewind() {
    this.player.currentTime -= 5;
  }

  seek(event) {
    if (!this.seeking) return;
    if (!this.player.paused) {
      this.wasPlaying = true;
      this.pause();
    }
    var p = (event.clientX - this.barRect.left) / this.barWidth;
    this.player.currentTime = this.player.duration * p;
  }

  seekTo(time) {
    this.player.currentTime = time;
  }

  adjustVolume(event) {
    if (!this.dragging) return;

    var scale = (event.clientX - this.volRect.left) / this.volRect.width;
    var vol = scale.toFixed(2);

    if (vol >= 1) {
      scale = vol = 1;
    } else if (vol <= 0) {
      scale = vol = 0;
    }

    this.player.volume = vol;
    this.setStyle(this.volumeBar.firstElementChild, {
      'transform': 'scale3d(' + scale + ',1,1)'
    });
  }

  setVolume(level) {
    level /= 100;
    this.player.volume = level;

    if (this.volumeControls) {
      this.setStyle(this.volumeBar.firstElementChild, {
        'transform': 'scale3d(' + level + ',1,1)'
      });
    }
  }

  updateProgress() {
    let currentTime = Math.floor(this.player.currentTime);
    let duration = Math.floor(this.player.duration);
    this.progress = currentTime / duration;
    this.setStyle(this.progressBar, {
      'transform': 'scale3d(' + this.progress + ',1,1)'
    });
    this.durationBox.innerHTML = this.format(currentTime) + ' / ' + this.format(duration);
  }

  reset() {
    this.player.currentTime = 0;
    this.updateProgress();
    this.container.classList.remove('playing');

    if (this.repeat) {
      this.play();
    }
  }

  format(seconds) {
    var time = new Date(seconds * 1000).toISOString().substr(11, 8),
      len = time.length,
      zeroes = time.slice(0, 2) == '00';
    if (zeroes) {
      return time.slice(3, len);
    }
    return time;
  }

  setStyle(element, properties) {
    var property, css = '';
    for (property in properties) {
      css += property + ': ' + properties[property] + ';';
    }
    element.style.cssText += css;
  }

  createUI() {
    var _scope = this;
    if (document.contains(document.getElementById(this.player.id + '_playr-ui'))) {
      document.getElementById(this.player.id + '_playr-ui').remove();
    }
    var ui = this.createElement('div', {
      class: 'playr-ui',
      id: this.player.id + '_playr-ui'
    });
    var controlsLeft = this.createElement('div', {
      class: 'playr-controls left'
    });
    var panel = this.createElement('div', {
      class: 'playr-panel'
    });
    var progress = this.createElement('div', {
      class: 'playr-progress'
    });

    this.titleBox = this.createElement('div', {
      class: 'playr-filename',
      html: '<span>' + _scope.sentence + '</span>'
    });

    this.durationBox = this.createElement('div', {
      class: 'playr-duration'
    });
    this.playButton = this.createElement('button', {
      class: 'playr-play',
      id: 'playr-play',
      //type: 'button'
      html: this.playButtonSvg
    });
    this.progressBar = this.createElement('div', {
      class: 'playr-progress-bar'
    });
    if (this.volumeControls) {
      ui.classList.add('volume-controls');
      var controlsRight = this.createElement('div', {
        class: 'playr-controls right'
      });
      var volume = this.createElement('div', {
        class: 'playr-volume'
      });

      this.volumeBar = this.createElement('div', {
        class: 'playr-volume-box',
        html: '<span></span>'
      });

      volume.appendChild(this.volumeBar);
      controlsRight.appendChild(volume);

      this.volumeBar.addEventListener("mousedown", function(event) {
        _scope.dragging = true;
        _scope.adjustVolume(event);
      }, false);

      window.addEventListener("mousemove", this.adjustVolume.bind(this), false);
    }

    if (this.seekControls) {
      ui.classList.add('seek-controls');
      // this.rwButton = this.createElement('button', {
      //   class: 'playr-rewind',
      //   type: 'button'
      // });
      this.rwButton = this.createElement('button', {
        class: 'playr-rewind',
        // type: 'button'
        html: this.rewindButtonSvg
      });
      controlsLeft.appendChild(this.rwButton);

      this.rwButton.addEventListener("click", this.rewind.bind(this), false);
    }

    controlsLeft.appendChild(this.playButton);

    if (this.seekControls) {
      this.ffButton = this.createElement('button', {
        class: 'playr-fastforward',
        // type: 'button'
        html: this.forwardButtonSvg
      });
      controlsLeft.appendChild(this.ffButton);

      this.ffButton.addEventListener("click", this.fastForward.bind(this), false);
    }

    progress.appendChild(this.progressBar);

    panel.appendChild(progress);
    panel.appendChild(_scope.titleBox);
    panel.appendChild(_scope.durationBox);

    ui.appendChild(controlsLeft);
    ui.appendChild(panel);

    if (this.volumeControls) {
      ui.appendChild(controlsRight);
    }

    this.container.appendChild(ui);

    this.setDimensions();
  }

  createElement(a, b) {
    var c = document,
      d = c.createElement(a);
    if (b && "object" == typeof b) {
      var e;
      for (e in b)
        if ("html" === e) d.innerHTML = b[e];
        else if ("text" === e) {
        var f = c.createTextNode(b[e]);
        d.appendChild(f)
      } else d.setAttribute(e, b[e])
    }
    return d
  }

  extend(options) {
    var option;
    for (option in options) {
      this[option] = options[option];
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  fetch('/file_processing/data_out/json/')
      .then(response => response.text())
      .then(async data => {
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(data, 'text/html');
        const files = htmlDoc.getElementById('files')
        const links = Array.from(files.querySelectorAll('a'));
        const audioData = [];
        for (const link of links) {
          const jsonUrl = link.getAttribute('href');

          try {
            const response = await fetch(jsonUrl);
            const json = await response.json();
            audioData.push(json);
          } catch (error) {
            console.error('Error fetching audio files:', error);
          }
        }

        var list = {
          "listName": "Audio Corpus",
          "files": audioData
        };

        player = new MediaPlayer(document.getElementById('player'));
        player.render({
          list: list
        });
        })
      .catch(error => console.error('Error fetching audio files:', error));
});


