import m from 'mithril'
import { ComponentTemplate, ViewTools, Model } from '../../src/main'
import { app } from '../app'
import { navigationCpt } from './navigation'

// Task list

const taskListTpl: ComponentTemplate = {
    sockets: ['taskList'],
    actions: () => ({
        '@init': () => (model) => {
            return model.setIn(['taskList'], [{id: 1, name: 'First task'}])
        }
    }),
    view: ({model}) => {
        console.log(model)
        return m('div', {class: 'task-list'}, model.taskList.asMutable().map((task: any) => m('div', {class: 'task-item'}, task.name)))
    }
}

const taskListCpt = app.createComponent(taskListTpl, {
    taskList: ['tasks', 'list']
})

// Task input

const taskInputTpl: ComponentTemplate = {
    sockets: ['taskInput', 'taskList'],
    actions: () => ({
        updateInput: (value) => (model: Model) => {
            return model.set('taskInput', value)
        },
        keyUp: (key) => (model: Model) => {
            if (key.code === 'Enter') return model
                .set('taskList', model.taskList.concat([{id: 1, name: model.taskInput}]))
                .set('taskInput', '')
            return model
        }
    }),
    view: ({model, actions}) => {
        return m('div', {class: 'task-input'}, [
            m('input', {
                value: model.taskInput,
                placeholder: 'Enter name for new note',
                oninput: m.withAttr('value', actions.updateInput),
                onkeyup: actions.keyUp
            })
        ])
    }
}

const taskInputCpt = app.createComponent(taskInputTpl, {
    taskInput: ['tasks', 'input'],
    taskList: ['tasks', 'list']
})

// Tasks page

export const tasksTpl: ComponentTemplate = {
    sockets: [],
    actions: () => ({
        '@init': () => (model: Model) => {
            return model.setIn(['currentUser', 'name'], 'Duck')
        }
    }),
    view: ({model, navigate}) =>
        m('div', {class: 'tasks'}, [
            navigationCpt(),
            m('div', {class: 'main'}, [
                taskInputCpt(),
                taskListCpt()
            ])
        ])
}

export const tasksCpt = app.createComponent(tasksTpl, {})
