module.exports = function(grunt) {
  grunt.initConfig({
    browserify: {
      main: {
        options: {
          transform: ['brfs']
        },
        files: {
          'dist/js/bundle.js': ['src/js/main.js']
        }
      },
      pdf: {
        options: {
          transform: ['brfs']
        },
        files: {
          'dist/js/pdf.js': ['src/js/pdf-entry.js']
        }
      }
    },
    uglify: {
      dist: {
        files: {
          'dist/js/bundle.min.js': ['dist/js/bundle.js'],
          'dist/js/pdf.min.js': ['dist/js/pdf.js']
        }
      }
    },
    cssmin: {
      dist: {
        files: {
          'dist/css/main.min.css': [
            'node_modules/bootstrap/dist/css/bootstrap.min.css',
            'src/css/main.css'
          ]
        }
      }
    },
    copy: {
      dist: {
        files: {
          'dist/index.html': ['src/index.html']
        }
      }
    },
    purgecss: {
      dist: {
        options: {
          content: ['src/index.html', 'src/js/**/*.js']
        },
        files: {
          'dist/css/main.min.css': ['dist/css/main.min.css']
        }
      }
    },
    watch: {
      scripts: {
        files: ["src/**/*.js", "src/**/*.css", "src/index.html"],
        tasks: ["default"]
      }
    }
  });

    // Import required tasks
    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-cssmin");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-purgecss");
    grunt.loadNpmTasks("grunt-contrib-watch");

    // Set default task to do everything
    grunt.registerTask("default", ["copy", "browserify", "uglify", "cssmin", "purgecss"]);
  };