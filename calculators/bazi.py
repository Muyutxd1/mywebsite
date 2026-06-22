"""
八字排盘 — Ba Zi (Four Pillars of Destiny) Calculator
"""
from core.ganzhi import full_pillars, GAN_WUXING


class BaziCalculator:
    """八字计算器"""

    def calculate(self, year, month, day, hour=0, minute=0):
        """
        Calculate full Ba Zi chart.
        Returns four pillars + wuxing analysis + interpretation.
        """
        year = int(year)
        month = int(month)
        day = int(day)
        hour = int(hour)

        pillars = full_pillars(year, month, day, hour)
        day_master = pillars['day_master']

        interpretation = self._interpret(pillars, day_master)

        return {
            'pillars': self._serialize_pillars(pillars),
            'day_master': day_master,
            'day_master_wuxing': GAN_WUXING.get(day_master, ''),
            'wuxing_count': pillars['wuxing_count'],
            'interpretation': interpretation,
        }

    def _serialize_pillars(self, pillars):
        """Convert pillars dict to JSON-serializable format."""
        result = {}
        for key in ['year', 'month', 'day', 'hour']:
            p = pillars[key]
            result[key] = {
                'gan': p['gan'],
                'zhi': p['zhi'],
                'full': p['full'],
                'gan_wuxing': p['gan_wuxing'],
                'zhi_wuxing': p['zhi_wuxing'],
                'zhi_canggan': p['zhi_canggan'],
                'shishen': p['shishen'],
                'nayin': p['nayin'],
            }
        return result

    def _wuxing_analysis(self, wuxing_count):
        """Analyze wuxing balance."""
        lines = []
        total = sum(wuxing_count.values())

        for wx, count in wuxing_count.items():
            pct = count / total * 100 if total > 0 else 0
            status = '偏旺' if pct > 25 else ('适中' if pct > 15 else '偏弱')
            lines.append(f'{wx}：{count}个（{pct:.0f}%），{status}')

        # Find most and least
        most = max(wuxing_count, key=wuxing_count.get)
        least = min(wuxing_count, key=wuxing_count.get)
        lines.append(f'')
        lines.append(f'五行最旺：{most}，宜用相克之物平衡。')
        lines.append(f'五行最弱：{least}，宜补其不足。')

        return '\n'.join(lines)

    def _interpret(self, pillars, day_master):
        """Generate comprehensive Ba Zi interpretation."""
        dm = day_master
        dm_wx = GAN_WUXING[dm]
        lines = []

        # Pillars table
        lines.append('【四柱排盘】')
        for key, label in [('year', '年柱'), ('month', '月柱'), ('day', '日柱'), ('hour', '时柱')]:
            p = pillars[key]
            lines.append(
                f'{label}：{p["full"]}  '
                f'天干{p["gan"]}({p["gan_wuxing"]})  '
                f'地支{p["zhi"]}({p["zhi_wuxing"]})  '
                f'藏干{" ".join(p["zhi_canggan"])}  '
                f'十神：{p["shishen"]}  '
                f'纳音：{p["nayin"]}'
            )

        lines.append('')
        lines.append(f'【日主】{dm}（{dm_wx}）')
        lines.append(f'日主代表你自己，是八字的核心。{dm}为{dm_wx}命之人。')

        # Day master personality
        personality = {
            '甲': '甲木参天，栋梁之材。正直、有担当、积极向上，但有时过于刚直。',
            '乙': '乙木柔韧，藤萝之姿。柔顺、善于变通、适应力强，但可能优柔寡断。',
            '丙': '丙火炽烈，太阳之光。热情、光明磊落、慷慨大方，但可能急躁冲动。',
            '丁': '丁火柔中，烛火之明。细腻、洞察人心、聪慧，但可能多疑。',
            '戊': '戊土厚重，城墙之固。稳重、诚信可靠、踏实，但可能固执保守。',
            '己': '己土温和，田园之土。包容、善于培育、温和，但可能缺乏主见。',
            '庚': '庚金刚健，刀斧之利。果断、坚毅不屈、正义感强，但可能过于刚硬。',
            '辛': '辛金精美，珠宝之贵。细腻、追求完美、优雅，但可能过于挑剔。',
            '壬': '壬水浩荡，江河之势。豁达、大气磅礴、智慧，但可能随波逐流。',
            '癸': '癸水柔细，雨露之润。细腻、善解人意、智慧内敛，但可能过于敏感。',
        }
        lines.append(personality.get(dm, ''))

        # Wuxing analysis
        lines.append('')
        lines.append('【五行分布】')
        lines.append(self._wuxing_analysis(pillars['wuxing_count']))

        # Ten gods analysis
        lines.append('')
        lines.append('【十神关系】')
        for key, label in [('year', '年'), ('month', '月'), ('hour', '时')]:
            p = pillars[key]
            lines.append(f'{label}柱十神：{p["shishen"]} — {p["gan"]}相对于日主{dm}的关系')

        shi_shen_desc = {
            '比肩': '比肩多则朋友多、竞争大。个性独立，喜欢靠自己。',
            '劫财': '劫财多则开销大，需防冲动消费和人际关系上的摩擦。',
            '食神': '食神旺则才艺出众、口福佳、性格温和。善于享受生活。',
            '伤官': '伤官旺则聪明过人但不服管束。创意十足但需防口舌是非。',
            '正财': '正财旺则财运稳定，善于理财持家。对财富态度务实。',
            '偏财': '偏财旺则有意外财运，投资眼光独到，但需防投机过度。',
            '正官': '正官旺则事业稳定、守规矩、有责任心。适合公职和管理。',
            '七杀': '七杀旺则有魄力、能担当大任，但压力也大。需以印星化解。',
            '正印': '正印旺则学业顺利、得长辈缘。心地善良、重情义。',
            '偏印': '偏印旺则偏门学问有天赋，适合玄学、研究类工作。',
        }
        for key in ['year', 'month', 'hour']:
            ss = pillars[key]['shishen']
            if ss in shi_shen_desc:
                lines.append(f'  → {shi_shen_desc[ss]}')

        # Overall summary
        lines.append('')
        lines.append('【综合批语】')
        lines.append(self._overall_summary(pillars, day_master))

        return '\n'.join(lines)

    def _overall_summary(self, pillars, day_master):
        """Generate overall summary."""
        wx_count = pillars['wuxing_count']
        most = max(wx_count, key=wx_count.get)
        least = min(wx_count, key=wx_count.get)

        dm_wx = GAN_WUXING[day_master]

        # Determine if day master is strong or weak
        dm_count = wx_count[dm_wx]
        controlling_wx = {'木': '金', '火': '水', '土': '木', '金': '火', '水': '土'}
        generating_wx = {'木': '水', '火': '木', '土': '火', '金': '土', '水': '金'}

        enemy_count = wx_count.get(controlling_wx.get(dm_wx, ''), 0)
        friend_count = wx_count.get(generating_wx.get(dm_wx, ''), 0)

        balance = dm_count + friend_count - enemy_count

        if balance >= 5:
            strength = '日主身强'
            advice = '八字中同类五行偏多，日主身强。宜用克泄耗之法（官杀/食伤/财星），喜'
            if controlling_wx.get(dm_wx):
                advice += f'{controlling_wx[dm_wx]}来平衡。'
        else:
            strength = '日主身弱'
            advice = '八字同类五行偏少，日主身弱。宜用生扶之法（印星/比劫），喜'
            if generating_wx.get(dm_wx):
                advice += f'{generating_wx[dm_wx]}和{dm_wx}来补足。'

        return f'{strength}。\n{advice}\n（注：以上仅为简略分析，详细命理解读需结合大运流年综合判断。仅供娱乐参考。）'
