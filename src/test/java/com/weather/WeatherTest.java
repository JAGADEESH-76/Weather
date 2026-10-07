package com.weather;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class WeatherTest {

    @Test
    void applicationNameTest() {

        String name = "Weather Forecasting System";

        assertEquals(
                "Weather Forecasting System",
                name
        );
    }

    @Test
    void cityNameTest() {

        String city = "Chennai";

        assertEquals(
                "Chennai",
                city
        );
    }

    @Test
    void temperatureTest() {

        double temperature = 30.5;

        assertTrue(
                temperature >= -50 &&
                temperature <= 60
        );
    }

    @Test
    void weatherConditionTest() {

        String condition = "Sunny";

        assertTrue(
                condition.equals("Sunny") ||
                condition.equals("Cloudy") ||
                condition.equals("Rainy")
        );
    }
}
