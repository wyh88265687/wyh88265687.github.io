document.addEventListener("click", ele => {
    const nodeName = ele.target.nodeName
    const link = ele.target.href
    if (nodeName == 'A' && link) {
        ele.preventDefault()
        location.href = link
    }
});
var danjia =$('#danjia');
var shuliang =$('#shuliang');
var zongjia = $('#zongjia');
$(function(){
    var mcscache = h5storage('mcscache');
    if(!is_empty(mcscache)){
        if(!is_empty(mcscache.danjia)){danjia.val(mcscache.danjia);}
        if(!is_empty(mcscache.shuliang)){shuliang.val(mcscache.shuliang);}
        if(!is_empty(mcscache.zongjia)){zongjia.val(mcscache.zongjia);}
    }
})
function qingkong(){
	danjia.val('');shuliang.val('');zongjia.val('');
    h5storage('mcscache','null');
}
function jisuan(){
	var danjia_val = formatnum(danjia.val());
	var shuliang_val = formatnum(shuliang.val());
	var zongjia_val = formatnum(zongjia.val());
	if(danjia_val==0 && shuliang_val==0 && zongjia_val==0){
		alert('请填写单价,数量和总价中任意两个');return false;
	}	
	if(danjia_val>0 && shuliang_val>0 && zongjia_val>0){
		alert('单价,数量和总价请留空其中一个');return false;
	}	
	if(danjia_val==0 && shuliang_val==0){
		alert('单价,数量和总价请留空其中一个');return false;
	}
	if(danjia_val==0 && zongjia_val==0){
		alert('单价和总价不能同时为空');return false;
	}	
	if(shuliang_val==0 && zongjia_val==0){
		alert('数量和总价不能同时为空');return false;
	}
    var mcscache = new Object;
	if(danjia_val>0)mcscache.danjia=danjia_val;
	if(shuliang_val>0)mcscache.shuliang=shuliang_val;
	if(zongjia_val>0)mcscache.zongjia=zongjia_val;
    if(!is_empty(mcscache)){h5storage('mcscache',mcscache);}
	
	if(danjia_val==0){
		danjia_newval=format_money(accDiv(zongjia_val,shuliang_val));
		danjia.val(danjia_newval);
	}
	if(shuliang_val==0){
		shuliang_newval=parseFloat(accDiv(zongjia_val,danjia_val));
		shuliang.val(shuliang_newval);
	}
	if(zongjia_val==0){
		zongjia_newval=format_money(accMul(danjia_val,shuliang_val));
		zongjia.val(zongjia_newval);
	}
}
function formatnum(num){
	if(num){ 
		return parseFloat(num);
	}else return 0;
}
function resetval(id){
	var resetval =$('#'+id);
	resetval.val('');
}
//格式化金额
function format_money(num,len,type) {
    len = len > 0 && len <= 20 ? len : 2;
    var result = parseFloat(num);
    num=isNaN(result)?0:result;
    var numpow=Math.pow(10,len);
    var numcheng=accMul(num,numpow);
    if(type==1){//ceil进一 
    	result = Math.ceil(numcheng);
    }else if(type==2){//floor舍去
    	result = Math.floor(numcheng);
    }else{//round四舍五入 
    	result = Math.round(numcheng);
    }result =accDiv(result,numpow);
    //round四舍五入 ceil进一 floor舍去
    var s_x = result.toString();
    var pos_decimal = s_x.indexOf('.');
    if (pos_decimal < 0) {pos_decimal = s_x.length;s_x += '.';}
    while (s_x.length <= pos_decimal + len) {s_x += '0';}
    return s_x;
}
//乘法函数
function accMul(arg1, arg2) {
    var x = new BigNumber(arg1);
    var y = new BigNumber(arg2);
    return x.multipliedBy(y);
}
//除法函数
function accDiv(arg1, arg2) {    
    var x = new BigNumber(arg1);
    var y = new BigNumber(arg2);
    return x.dividedBy(y);
}
/**
 * 缓存
 * @param key 缓存名
 * @param value 缓存值 为空 则获取值 不为空则为设置值 null 清空当前值 clear 清空全部
 * @param type 存储类型 1 localStorage 2 sessionStorage 3 cookie
 */
function h5storage(key,value,type){
    if(!key)return false;
    if(!type)type=1;
    if(type==1 && typeof localStorage=='object'){type=1;}else if(type==2 && typeof sessionStorage=='object'){type=2;}else{type=3;}
    if(value && (typeof value=='object' || typeof value=='array')){value=JSON.stringify(value);}
    switch(type){
        case 1:
        if(value=='null'){return localStorage.removeItem(key);}
        if(value=='clear'){return localStorage.clear();}
        if(value){
            return localStorage.setItem(key,value);
        }else{
            var data=localStorage.getItem(key);
            return data && data.indexOf('}')>0?JSON.parse(data):data;
        }
        break;
        case 2:
        if(value=='null'){return sessionStorage.removeItem(key);}
        if(value=='clear'){return sessionStorage.clear();}
        if(value){
            return sessionStorage.setItem(key, value);
        }else{
            var data=sessionStorage.getItem(key);
            return data && data.indexOf('}')>0?JSON.parse(data):data;
        }
        break;
        default:
        if(value=='null' || value=='clear'){return document.cookie=key+'=;';}
        if(value){var oDate=new Date();oDate.setDate(oDate.getDate()+7);       
            document.cookie=key+'='+value+';expires='+oDate;
            return true;
        }else{var arr=document.cookie.split('; ');  
            for(var i=0;i<arr.length;i++){    
                var arr2=arr[i].split('=');if(arr2[0]==key){var data=arr2[1];return data && data.indexOf('}')>0?JSON.parse(data):data;}   
            }return '';
        }
        break;
    }
}
function is_empty(obj){
    if (!obj || obj=='') return true; 
    if (typeof obj === "string") {
      obj = obj.replace(/\s*/g, "");//移除字符串中所有 ''
      if (obj === '') return true;
    } 
    return (Array.isArray(obj) && obj.length === 0) || (Object.prototype.isPrototypeOf(obj) && Object.keys(obj).length === 0);
}