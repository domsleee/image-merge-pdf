module.exports = function(grunt) {
  grunt.initConfig({
    browserify: {
      dist: {
        files: {
          'dist/js/bundle.js': ['src/js/main.js']
        }
      }
    },
    cssmin: {
      my_target: {
        files: [{
          expand:true,
          cwd:"src/css",
          src:["*.css"],
          dest:"dist/css/",
          ext:".min.css"
        }]
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
    grunt.loadNpmTasks("grunt-shell");
    grunt.loadNpmTasks("grunt-contrib-watch");

    // Set default task to do everything
    grunt.registerTask("default", ["browserify", "cssmin"]);
    grunt.registerTask("deploy", ["browserify", "cssmin", "shell"]);
  };