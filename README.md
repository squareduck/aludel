# Aludel

Web application framework with components living in subjective realities.

## Installing

`npm install aludel`

## Learning

TODO: Add links to guides in the wiki

## Overview

Aludel tries to solve the Model part of Model → View relationship in most Virtual DOM inspired approaches. There is little doubt that "View is pure function of the Model" idea is working, but how exactly this Model should be implemented is up for a debate.

Main design goal for Aludel is to define a strict protocol of interaction between Components and Global State, and enforce it at runtime.

To achieve this Aludel enables you to declare which parts of global state are accessible by each Component. And then makes sure that Component Intances only see what they wanted to see by constructing a Local Model for them.

There are two ways to use this library. Component Instances and Routing can be managed manually by using Context and Router. Or you can use App and RoutedApp helpers to let Aludel take care of low level details.

See the description for Context, Router, App, and RoutedApp below.

Any Virtual DOM library should work with Aludel. It exposes a callback that will return either the latest version of Global State (if you are using Context), or the latest topmost Component Instance (if you are using the App or RoutedApp abstraction).

### Components

#### Template

##### Sockets

##### Actions

##### Render

#### Component

##### Paths

#### Instance

### Context

#### Global State

#### Reacting to changes

### Router

#### Defining routes

##### Route component

##### Route action

##### Subroutes

#### Additional configuration

### App

### RoutedApp
