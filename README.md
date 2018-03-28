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

Components in Aludel have three stages - Template, Component, Instance. Each next stage is a more specialized version of previous one.

#### Template

Template describes _Sockets_, _Actions_, and _Render function_.

```javascript
const template = createTemplate({
    sockets: ['counter'],
    actions: {
        add: amount => model => {
            model.counter += amount
            return model
        },
    },
    render: ({ model }) => {
        return h('div', {}, [
            h('button', { onclick: () => action.add(-1) }, 'Decrement'),
            h('div', {}, model.counter),
            h('button', { onclick: () => action.add(1) }, 'Increment'),
        ])
    },
})
```

##### Sockets

Sockets describe top fields of Local Model that will be constructed for Component Instance. In example above we have one socket `'counter'`. We don't know yet which part of Global State this socket will map to. But our Local Model, available in _Actions_ and _Render function_ will have a `'counter'` field for sure.

There is an implicit contract here in how this field is used. For example in code above we expect `'counter'` to be a number.

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
