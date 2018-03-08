# Aludel

![Logo](https://thumbs.dreamstime.com/t/alembic-d-cartoon-illustration-70135996.jpg)

Web framework with components living in subjective realities.

## Main principles

### Declarative style

Components have three stages:
1. Component template - describes sockets, actions, and render function.
```
//
// Using mithril.js as renderer (but can be any Virtual Dom library)
//
const template = {
    sockets: ['name'],
    actions: {
        exclaim: () => (model) => {
            return model.set('name', model.name + '!')
        }
    },
    render: ({model, actions}) => {
        return m('h1', {onclick: actions.exclaim}, 'Hello, ' + model.name)
    }
}
```
2. Component - In addition to template contains "paths" (which is a lense into global model) for each socket, and optional name.
```
const component = {
    template: template,
    paths: {
      name: ['currentUser', 'name']
    }
}
```
3. Component instance - a function that returns "renderer-ready" value. This step is done by Aludel automatically when needed.

### Immutable global state

There is only place where state is stored. State updates are performed by component or route actions with are simple functions:
```(currentState) => newState```

### Subjective model
### Routing 
### Bring your own renderer
