pipeline {

    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out Weather project...'
            }
        }

        stage('Clean') {
            steps {
                bat 'mvn clean'
            }
        }

        stage('Compile') {
            steps {
                bat 'mvn compile'
            }
        }

        stage('Test') {
            steps {
                bat 'mvn test'
            }
        }

        stage('Package') {
            steps {
                bat 'mvn package -DskipTests'
            }
        }
    }

    post {

        success {
            echo '======================================'
            echo 'WEATHER PROJECT BUILD SUCCESSFUL'
            echo 'ALL TEST CASES PASSED'
            echo '======================================'
        }

        failure {
            echo '======================================'
            echo 'WEATHER PROJECT BUILD FAILED'
            echo 'CHECK THE JENKINS CONSOLE'
            echo '======================================'
        }
    }
}
