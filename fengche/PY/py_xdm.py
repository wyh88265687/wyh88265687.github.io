import re,sys,json,urllib3
from base.spider import Spider
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
sys.path.append('..')

class Spider(Spider):
    headers,host,player = {
        'User-Agent': "okhttp/3.10.0",
        'Connection': "Keep-Alive",
        'Accept-Encoding': "gzip"
    }, 'http://154.219.117.219:8080',{}

    def homeContent(self, filter):
        return {'class': [{'type_id': 1, 'type_name': '电影'}, {'type_id': 2, 'type_name': '电视剧'}, {'type_id': 4, 'type_name': '动漫'}, {'type_id': 3, 'type_name': '综艺'}, {'type_id': 22, 'type_name': '纪录片'}, {'type_id': 24, 'type_name': '少儿'}, {'type_id': 26, 'type_name': '短剧'}]}

    def homeVideoContent(self):
        response = self.fetch(f'{self.host}/dev_webvip/v4/app/homeListNew?type=0', headers=self.headers, verify=False).json()
        data = response['data']
        videos = []
        for i in data:
            if isinstance(i,dict) and 'dataInfoList' in i:
                videos.extend(self.json2vods(i['dataInfoList']))
        return {'list': videos}

    def categoryContent(self, tid, pg, filter, extend):
        response = self.fetch(f'{self.host}/dev_webvip/v2/app/getVideoList?pageSize=12&currentPage={pg}&type={tid}', headers=self.headers, verify=False).json()
        data = response['data']
        return {'list': self.json2vods(data['list']),'pagecount': data['pages'], 'page': pg}

    def searchContent(self, key, quick, pg='1'):
        response = self.post(f'{self.host}/dev_webvip/v2/app/getVideoListType', data={'name':key}, headers=self.headers, verify=False).json()
        return {'list': self.json2vods(response['data']), 'page': pg}

    def detailContent(self, ids):
        vid, detail = ids[0].split('@',1)
        details = json.loads(detail)
        response = self.fetch(f'{self.host}/dev_webvip/v1/typeNameList/totalList?vDetailId={vid}', headers=self.headers, verify=False).json()
        data = response['data']
        for i in data['vipTypeUrlNames']:
            self.player[i['vUrlType']] = {
                'typeUrlName': i['typeUrlName'],
                'jxApi': i['jxApi'],
                'ua': i['ua']
            }
        show, play_urls = [], []
        name,urls = '',  []
        for i in data['videoUrlLists']:
            if not name: name = self.player[i['vUrlType']]['typeUrlName']
            urls.append(f"{i['vTitle']}${i['vUrlType']}@{i.get('vUrl',i.get('gfUrl',''))}")
        show.append(name)
        play_urls.append('#'.join(urls))
        video = {
            'vod_id': vid,
            **details,
            'vod_play_from': '$$$'.join(show),
            'vod_play_url': '$$$'.join(play_urls)
        }
        return {'list': [video]}

    def playerContent(self, flag, vid, vip_flags):
        jx, url, play_ua = 0, '','Lavf/58.12.100'
        v_url_type, raw_url = vid.split('@',1)
        v_url_type = self.player[v_url_type]
        try:
            if v_url_type['jxApi'] and isinstance(v_url_type['jxApi'],str):
                response = self.fetch(f"{v_url_type['jxApi']}{raw_url}", headers=self.headers, verify=False).json()
                play_url = response['url']
                if play_url.startswith('http') and play_url != raw_url:
                    url = play_url
                ua = response.get('UA')
                if ua: play_ua = ua
        except Exception:
            pass
        if v_url_type['ua'] and isinstance(v_url_type['ua'],str):
            play_ua = v_url_type['ua'].replace('User-Agent=>','')
        if not url:
            if raw_url.startswith('http'):
                jx, url = 0, raw_url
            elif re.search(r'(?:www\.iqiyi|v\.qq|v\.youku|www\.mgtv|www\.bilibili)\.com', raw_url):
                jx, url = 1, raw_url
        return { 'jx': jx, 'parse': 0, 'url': url, 'header': {'User-Agent': play_ua}}

    def json2vods(self,arr):
        videos = []
        if isinstance(arr,list):
            for i in arr:
                remake = ''
                vRemake = json.loads(i['vRemake'])
                for j in vRemake:
                    if j['remake']:
                        remake = j['remake']
                detail = json.dumps({
                    'vod_pic': i['vPic'],
                    'vod_remarks': remake,
                    'vod_year': i['vYear'],
                    'vod_area': i['vArea'],
                    'vod_actor': i['vActor'],
                    'vod_director': i['vWriter'],
                    'vod_content': i['vContent'],
                    'type_name': i['vClass']
                },ensure_ascii=False, separators=(',', ':'))
                videos.append({
                    'vod_id': f"{i.get('vDetailId',i.get('id'))}@{detail}",
                    'vod_name': i['vName'],
                    'vod_pic': i['vPic'],
                    'vod_remarks': remake,
                    'vod_content': i.get('vBlurb',i.get('vContent'))
                })
        return videos

    def init(self, extend=""):
        pass

    def getName(self):
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def destroy(self):
        pass

    def localProxy(self, param):
        pass
