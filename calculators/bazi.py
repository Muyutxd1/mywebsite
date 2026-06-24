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
        lines.append('')
        lines.append('─' * 24)
        lines.append('【综合批语】')
        self._overall_summary(lines, pillars, day_master)

        return '\n'.join(lines)

    def _overall_summary(self, lines, pillars, day_master):
        """Generate comprehensive overall summary."""
        wx_count = pillars['wuxing_count']
        dm_wx = GAN_WUXING[day_master]
        controlling_wx = {'木': '金', '火': '水', '土': '木', '金': '火', '水': '土'}
        generating_wx = {'木': '水', '火': '木', '土': '火', '金': '土', '水': '金'}
        dm_count = wx_count[dm_wx]
        enemy_count = wx_count.get(controlling_wx.get(dm_wx, ''), 0)
        friend_count = wx_count.get(generating_wx.get(dm_wx, ''), 0)
        balance = dm_count + friend_count - enemy_count

        lines.append('')
        lines.append('【身强身弱】')
        if balance >= 5:
            lines.append(f'日主{day_master}（{dm_wx}）身强。八字中同类五行偏多，')
            lines.append(f'个性较为强势自主、抗压能力强。宜用克泄耗之法——')
            use_wx = controlling_wx.get(dm_wx, '')
            lines.append(f'喜{use_wx}来平衡，事业上适合发挥才智和创造力。')
        else:
            lines.append(f'日主{day_master}（{dm_wx}）身弱。八字同类五行偏少，')
            lines.append(f'个性较为温和、容易受人影响，但也更加灵活。宜用生扶之法——')
            use_wx = generating_wx.get(dm_wx, '')
            lines.append(f'喜{use_wx}和{dm_wx}来补足，事业上宜与人合作、借力而行。')

        lines.append('')
        lines.append('【性格特征】')
        # Day master personality is already shown, add wuxing-based traits
        wx_personality = {
            '木': '有生长向上的精神，仁慈善良、爱好和平，但有时优柔寡断。',
            '火': '热情外放、行动迅速，有感染力但容易急躁冲动。',
            '土': '稳重诚信、可靠踏实，有包容力但偏保守固执。',
            '金': '刚毅果断、正义感强，执行力强但有时过于刚硬、不懂变通。',
            '水': '智慧灵活、适应力强，善于变通但易随波逐流、缺乏定性。',
        }
        lines.append(f'日主{dm_wx}命——{wx_personality.get(dm_wx, "")}')

        lines.append('')
        lines.append('【职业方向建议】')
        career_wx = {
            '木': '教育、文化、出版、医疗、园林、环保',
            '火': '演艺、餐饮、能源、科技、设计、营销',
            '土': '房地产、建筑、农业、管理、金融',
            '金': '法律、金融、工程、军警、机械、珠宝',
            '水': '传媒、物流、旅游、水产、咨询、玄学',
        }
        use_wx = controlling_wx.get(dm_wx, dm_wx) if balance >= 5 else generating_wx.get(dm_wx, dm_wx)
        lines.append(f'适合五行属{use_wx}的行业：{career_wx.get(use_wx, "综合类")}。')
        # Also suggest based on 十神
        lines.append(f'也宜结合八字中最旺的十神方向发展。')

        lines.append('')
        lines.append('【人际关系】')
        wx_relation = {
            '木': '待人真诚如春风，人缘较好但需防过于心软。',
            '火': '热情开朗易交友，但有时过于直接让人措手不及。',
            '土': '忠厚可靠、朋友信赖你，但需主动拓展社交圈。',
            '金': '重义气、朋友不多但个个真心，需注意不要太严肃。',
            '水': '善于与各种人打交道，社交灵活但需保持真诚。',
        }
        lines.append(wx_relation.get(dm_wx, ''))

        lines.append('')
        lines.append('【人生忠告】')
        advices = {
            '木': '像大树一样向下扎根、向上生长。不求速成，但求稳健。',
            '火': '你的热情是最大的财富，但偶尔需要"熄火"休息，给自己充电。',
            '土': '稳重大气是你的名片，但有时候迈出一步才能看到更大的世界。',
            '金': '刚毅是你的力量，但刚柔并济才能无坚不摧。',
            '水': '上善若水，你的智慧在于变通，但需要为自己找一个"容器"——一个明确的方向。',
        }
        lines.append(advices.get(dm_wx, ''))
        lines.append('')
        lines.append('（注：以上为简略八字分析，详细命理需结合大运流年综合判断。仅供娱乐参考。）')
