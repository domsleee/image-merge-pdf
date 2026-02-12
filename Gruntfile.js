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
    purgecss: {
      dist: {
        options: {
          content: ['dist/index.html', 'src/js/**/*.js']
        },
        files: {
          'dist/css/main.min.css': ['dist/css/main.min.css']
        }
      }
    },
    shell: {
      deploy: {
        command: "git add dist && git subtree push --prefix dist origin gh-pages"
      }
    },
    watch: {
      scripts: {
        files: ["src/**/*.js", "src/**/*.css"],
        tasks: ["default"]
      }
    }
  });

    // Import required tasks
    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-cssmin");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-purgecss");
    grunt.loadNpmTasks("grunt-shell");
    grunt.loadNpmTasks("grunt-contrib-watch");

    // Set default task to do everything
    grunt.registerTask("default", ["browserify", "uglify", "cssmin", "purgecss"]);
    grunt.registerTask("deploy", ["browserify", "uglify", "cssmin", "purgecss", "shell"]);
  };