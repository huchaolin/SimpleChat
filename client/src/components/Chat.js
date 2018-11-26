import React, { Component } from 'react';
import {List, InputItem, WhiteSpace, WingBlank, Button, Modal, Toast, Icon} from 'antd-mobile';
import request from 'axios';
import moment from 'moment';
import last from 'lodash/last';
import isEmpty from 'lodash/isEmpty';
import { NativeEventSource, EventSourcePolyfill } from 'event-source-polyfill';

import ContentInput from './ContentInput';
import MessageContainer from './MessageContainer';
import ToolBox from './ToolBox';
import './Chat.css';
import personA from '../images/personA.png';
import personB from '../images/personB.png';
import 'moment/locale/zh-cn';
moment.locale('zh-cn');
const config = {
    images: {
        personA,
        personB
    }
};

// const store = JSON.parse(localStorage.getItem('chatStore')) || {};
const EventSource = NativeEventSource || EventSourcePolyfill;

export default class Chat extends Component {
    constructor(props) {
        super(props);

        const chatId = last(window.location.pathname.split('/'));
        this.chatId = chatId;

        // if (store[chatId]) {
        //     this.state.user = store[chatId].user;
        //     this.state.key = store[chatId].key;
        // }

        this.conentScrollBoxRef = React.createRef();
        this.isPermitNotification = false;
        this.handleImgUploading = this.handleImgUploading.bind(this);
        this.handleNewRoomInfoSet = this.handleNewRoomInfoSet.bind(this);
        this.createNewRoomAlert = this.createNewRoomAlert.bind(this);
        this.renderNewRoomAdress = this.renderNewRoomAdress.bind(this);
    }

    state = {
        user: '',
        messages: [],
        input: '',
        pageCount: 1,
        isPhoneNotice: false,
        loadingImgUrl: '',
        isToolBoxVisible: false,
        roomName: '', // 新创建房间的房间名
        resRoomName: '', // 返回的房间名
        key: '', // 房间暗号
        showNewRoomAdressAlert: false, // 是否展示新创建房间地址信息
    }

    componentWillUnmount = () => {
        clearInterval(this.interval);
    }

    componentDidMount = () => {
        const chatId = this.chatId;

        // 滚到底
        this.scrollToBottom();

        // 滚动事件
        // window.addEventListener('scroll', this.handleScroll);

        // const evtSource = new EventSource('/api/stream');

        // evtSource.addEventListener('message', function (event) {
        //     const data = event.data;
        //      console.log(data);
        //   }, false);

        // 初始
        request.post('/api/chat/auth', {
            chatId
        }).then(res => {
            if (res.data.success) {
                this.setState({
                    isLogin: true,
                    user: res.data.result.user
                })
                this.start();
            }
        });
    
        // 通知
        const callback = res => {
            if (res === 'granted') {
                this.isPermitNotification = true;
            }
        };
        window.Notification && Notification.requestPermission(callback).then(callback);
    }

    componentDidUpdate() {
        this.scrollToBottom();
    }
     
    handleImgUploading(loadingImgUrl) {
        this.setState({
            loadingImgUrl,
        });
    }

    handleContentLoad = () => {
        this.scrollToBottom();
    }

    // 初始事件
    start() {
        const chatId = this.chatId;

        // this.getMessages(true);
        // if (!this.interval) {
        //     this.interval = setInterval(() => {
        //         this.getMessages();
        //     }, 1000);
        // }

        const evtSource = new EventSource(`/api/message/events?chatId=${chatId}`);
        console.log("EventSource start." + new Date());

        evtSource.onerror = () => {
            this.setState({messages: []});
            console.log("EventSource failed." + new Date());
        };

        evtSource.onmessage = evt => {
             let data = JSON.parse(evt.data);
             if (!Array.isArray(data)) {
                data = [data];
             }

             this.setState({
                 messages: [
                     ...this.state.messages,
                     ...data
                 ]
             })
        };

        evtSource.addEventListener('withdraw', evt => {
            let {id} = JSON.parse(evt.data);

            const messages = this.state.messages.map(item => {
                if (item.id === id) {
                    return {
                        ...item,
                        isWithDraw: true
                    };
                }
                return item;
            })
            this.setState({
                messages
            })
       });
    }

    stop() {
        clearInterval(this.interval);
    }

    inputUserNameAlert() {
        const chatId = this.chatId;
        Modal.prompt(null, null,
            [
                {
                    text: '取消',
                    onPress: value => new Promise((resolve) => {
                        resolve();
                    }),
                },
                {
                    text: '确定',
                    onPress: value => new Promise((resolve, reject) => {
                        request.post('/api/chat/auth', {
                            chatId,
                            user: value
                        }).then(res => {
                            if (res.data.success) {
                                const user =  res.data.result.user;
                                this.setState({
                                    isLogin: true,
                                    user,
                                })

                                resolve();
                                Toast.info('设置成功', 1);

                                // 昵称设置成功并马上发送之前输入的消息
                                const {input, isPhoneNotice} = this.state;

                                if (!isEmpty(input)) {
                                    // const to = user === 'personA' ? 'personB' : 'personA';
                                    request.post('/api/message/create', {
                                        from: user,
                                        chatId,
                                        isPhoneNotice,
                                        content: input
                                    }).then(({data} = {}) => {
                                        if (data.success === false) {
                                            document.write(data.message);
                                            window.location.reload();
                                        }
                                    });
                                    this.setState({input: '', isPhoneNotice: false});
                                }
                            }
                            reject();                            
                        });
                    }),
                },
            ], 'default', null, ['请输入昵称'])
    }

    handleNewRoomInfoSet(key, e) {
        const value = e.currentTarget.value;
        console.log(key, value)
        this.setState({
            [key]: value
        })
    }

    createNewRoomAlert() {
        const that = this;
        // 新建聊天页弹窗
        return Modal.alert('创建新的聊天房间',
                <div className="am-modal-input-container create-new-room-container">
                    <div className="am-modal-input">
                        <label><input type="text" onChange={(e) => that.handleNewRoomInfoSet('roomName', e)} placeholder="输入房间名称, 必填" /></label>
                    </div>
                    <div className="am-modal-input">
                         <label><input type="text" onChange={(e) => that.handleNewRoomInfoSet('key', e)} placeholder="设置暗号以创建私密房间, 非必填)" /></label>
                     </div>
                </div>
                ,
            [
                {
                    text: '取消',
                    onPress: value => {
                        console.log('取消创建新聊天房间')
                    },
                },
                {
                    text: '创建',
                    onPress: v => {
                        return new Promise((resolve, reject) => {
                            const { roomName, key } = this.state;
                            if (isEmpty(roomName)) {
                                Toast.info('房间名必填', 1);
                                return reject();
                            };
                            const path = isEmpty(key) ? 'public' : 'secret';// 已填写房间名, 且未填写暗号，创建公共聊天窗口, 否则，创建私有房间
                            request.post(`/api/chat/${path}/create`, {
                                            roomName,
                                            key,
                                        }).then(res => {
                                            if (res && (res.status == 200) && res.data.chatId) {
                                                resolve();
                                                this.setState({
                                                    chatId: res.data.chatId,
                                                    key: '',
                                                    showNewRoomAdressAlert: true
                                                });
                                                // 重置key 与roomName 以保证下次正常创建房间
                                                this.setState(prevState => { 
                                                    return {
                                                        resRoomName: prevState.roomName,
                                                        roomName: '',
                                                    }
                                                })
                                            }
                                        })
                        })
                    }
                }
            ])
    }

    renderNewRoomAdress() {
        const newRoomAddress = `${window.location.origin}/${this.state.chatId}?roomname=${this.state.resRoomName}`;
        return  (<Modal
        visible={this.state.showNewRoomAdressAlert}
        transparent
        maskClosable={false}

        title="创建新聊天房间成功"
        footer={[{ text: '确定', onPress: () => this.setState({showNewRoomAdressAlert: false})}]}
      >
        <div>
            长按复制 或 点击后在新窗口打开
        </div>
        <div>
            <a href={newRoomAddress} target='_blank'>{newRoomAddress}</a>
        </div>
      </Modal>)
    }

    scrollToBottom = () => {
        const conentScrollBox = this.conentScrollBoxRef.current;

        if (!conentScrollBox) {
            return;
        }

        conentScrollBox.scrollTop = conentScrollBox.scrollHeight;
    }

    getMessages(isFirst) {
        const chatId = this.chatId;
        // const key = this.state.key;

        return request.post('/api/message/list', {
            size: 10 * this.state.pageCount,
            chatId
        }).then(({data} = {}) => {
            if (data.success === false) {
                document.write(data.message);
                this.stop();
                return;
            }

            const messages = data.result;
            const lastNew = last(messages) || {};
            const lastOld = last(this.state.messages) || {};

            if (lastNew.updatedAt === lastOld.updatedAt && messages.length === this.state.messages.length) {
                return;
            }

            this.setState({messages});

            if (this.isPermitNotification && lastNew.createdAt !== lastOld.createdAt && this.state.user !== lastNew.from) {
                new Notification(`You've got a notification`, {
                    // body: lastNew.content,
                    icon: config.images[lastNew.from]
                });
            }
        });
    }

    handleLogin = () => {
        const chatId = this.chatId;
        const {inputKey, inputUser} = this.state;

        request.post('/api/chat/auth', {
            user: inputUser,
            key: inputKey,
            chatId
        }).then(res => {
            if (res.data.success) {
                this.setState({
                    isLogin: true,
                    user: res.data.result.user
                })
                this.start();
            }
            else {
                document.write(res.data.message);
                this.stop();
            }
        });
    }

    handleSubmit = event => {
        event.preventDefault();
        const {user, input, isPhoneNotice} = this.state;
        const chatId = this.chatId;

        if (!user) {
            return this.inputUserNameAlert();
        }

        if (isEmpty(input)) {
            return;
        }

        // const to = user === 'personA' ? 'personB' : 'personA';
        request.post('/api/message/create', {
            from: user,
            chatId,
            isPhoneNotice,
            content: input
        }).then(({data} = {}) => {
            if (data.success === false) {
                document.write(data.message);
                window.location.reload();
            }
        });

        this.setState({input: '', isPhoneNotice: false});
    }

    handleChange = event => {
        this.setState({input: event.target.value});
    }

    handleChangePhone = event => {
        this.setState({isPhoneNotice: event.target.checked});
    }

    handleSeeMore = () => {
        this.setState({pageCount: this.state.pageCount + 1}, this.getMessages);
    }

    handleUserChange = e => {
        this.setState({
            inputUser: e
        });
    }

    handleKeyChange = e => {
        this.setState({
            inputKey: e
        });
    }

    handleToolBoxVisibleToggle = () => {
        this.setState({
            isToolBoxVisible: !this.state.isToolBoxVisible
        });
    }

    renderActivity() {
        return (
            null
        );
    }

    renderLogin() {
        return (
            <div style={{paddingTop: "10%"}}>
                <WingBlank>
                    <InputItem onChange={this.handleUserChange}>昵称</InputItem>
                    <WhiteSpace />
                    <WhiteSpace />
                    
                    <InputItem onChange={this.handleKeyChange}>暗号</InputItem>
                    <WhiteSpace />
                    <WhiteSpace />
                    <WhiteSpace />
                    <WhiteSpace />
                    <WhiteSpace />
                    <WhiteSpace />
                    <WhiteSpace />
                    <Button onClick={this.handleLogin} type="primary">登录</Button>
                </WingBlank>
            </div>
            
        )
    }

   getRoomName() {
    // 从查询字符串中红获取房间名
    const roomName = window.location.search.split('=')[1];
    if (roomName) {
        return decodeURIComponent(roomName)
    };
    return null;
   }

    renderChat() {
        const {user, messages = [], isToolBoxVisible} = this.state;
        const chatId = this.chatId;
        const roomName = this.getRoomName();
        console.log('roomName',roomName)
        const chatWrapStyle = {height: '100%', padding:'0 10px'};
        const msgWrapStyle = {height: '100%', paddingTop: roomName ? '2.5rem': '1rem', paddingBottom: isToolBoxVisible ? '9rem' : '3rem', boxSizing: 'border-box'};
        const roomNameStyle = {height: '2.5rem', width:'100%', lineHeight: '2.5rem', textAlign: 'center', position: 'fixed', top: '0', left: '0', color: 'rgb(250, 250, 250)', fontSize: '1rem',
        backgroundColor: 'rgb(45,44,49)' }
        return (
            <div style={chatWrapStyle}>
                <div style={msgWrapStyle}>
                <div ref={this.conentScrollBoxRef} style={{overflow: 'auto', height: '100%', padding: '0'}}>
                    <MessageContainer onContentLoad={this.handleContentLoad} chatId={chatId} user={user} messages={messages} />
                </div>
                </div>
                {this.renderInput()}
                {this.renderNewRoomAdress()}
                {roomName ? <div style={roomNameStyle}>房间名：{roomName}</div> : null}
            </div>
        );
    }

    renderInput() {
        const isToolBoxVisible = this.state.isToolBoxVisible;
        const inputWrapStyle = {position: 'absolute', bottom: '1rem', left: '0', width: '100%', boxSizing: 'border-box', padding: '0 10px'}
        return (
            <div style={inputWrapStyle}>
                <form onSubmit={this.handleSubmit}>
                    <div style={{position: 'relative'}}>
                      {!!this.state.loadingImgUrl  ? (<div style={{ width: "5rem", position: "absolute", minHeight: '23px', right: "0", bottom: "2rem" }}>
                                <img style={{ width: "100%" }} src={this.state.loadingImgUrl} />
                                <div style={{ backgroundColor: "rgba(51, 47, 47, 0.63)", position: "absolute", height: "100%", width: "100%", left: "0", top: "0" }}>
                                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                                        <Icon type="loading" size="md" color="#047" />
                                    </div>
                                </div>
                        </div>) : null}
                        <div style={{paddingRight: '2rem'}}>
                            <ContentInput value={this.state.input} onChange={this.handleChange} onImgUploading={this.handleImgUploading}/>
                        </div>
                        <div onClick={this.handleToolBoxVisibleToggle} style={{position: 'absolute', right: 0, top: 0}}>
                            <i style={{fontSize: '1.6rem'}} className={`${isToolBoxVisible ? 'icon-minus' : 'icon-add'} iconfont`}></i>
                        </div>
                    </div>
                    <ToolBox isVisible={isToolBoxVisible} onImgUploading={this.handleImgUploading} createNewRoomAlert={this.createNewRoomAlert}/>                
                </form>
           </div>
        )
    }

    render() {
        return this.state.isLogin ?  this.renderChat() : this.renderLogin();
    }
}